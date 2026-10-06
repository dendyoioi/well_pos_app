import React, { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  UserCheck,
  X,
  CheckCircle2,
  AlertTriangle,
  Users,
  KeyRound,
  FileText,
  Calendar,
  Globe,
  LogOut,
  LogIn,
} from 'lucide-react';
import { attendanceApi } from '../../services/api';
import type { StaffAttendanceItem, AttendanceRecord, AttendanceConfig } from '../../types/attendance';
import type { Outlet } from '../../types/outlet';

interface StaffAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOutlet?: Outlet | null;
}

export const StaffAttendanceModal: React.FC<StaffAttendanceModalProps> = ({
  isOpen,
  onClose,
  activeOutlet,
}) => {
  const [activeTab, setActiveTab] = useState<'ACTION' | 'HISTORY'>('ACTION');
  const [loading, setLoading] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data absensi hari ini
  const [workDate, setWorkDate] = useState<string>('');
  const [timezone, setTimezone] = useState<string>('Asia/Jakarta');
  const [attendanceConfig, setAttendanceConfig] = useState<AttendanceConfig | null>(null);
  const [staffList, setStaffList] = useState<StaffAttendanceItem[]>([]);
  const [todayAttendances, setTodayAttendances] = useState<AttendanceRecord[]>([]);

  // Form state
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Live Digital Clock
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format jam lokal sesuai timezone outlet
  const formatLocalTime = useCallback(
    (d: Date, withSeconds = true) => {
      try {
        return new Intl.DateTimeFormat('id-ID', {
          timeZone: timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: withSeconds ? '2-digit' : undefined,
          hour12: false,
        }).format(d);
      } catch {
        return d.toTimeString().slice(0, withSeconds ? 8 : 5);
      }
    },
    [timezone]
  );

  // Ambil label zona waktu (WIB / WITA / WIT)
  const getTimezoneLabel = (tz: string) => {
    if (tz.includes('Makassar') || tz.includes('Ujung_Pandang') || tz.includes('Bali') || tz.includes('WITA')) {
      return 'WITA (UTC+8)';
    }
    if (tz.includes('Jayapura') || tz.includes('WIT')) {
      return 'WIT (UTC+9)';
    }
    return 'WIB (UTC+7)';
  };

  // Muat data absensi outlet hari ini
  const loadTodayData = useCallback(async () => {
    if (!activeOutlet?.id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await attendanceApi.getTodayAttendance(activeOutlet.id);
      if (res.status === 'success') {
        setWorkDate(res.data.workDate);
        setTimezone(res.data.timezone || 'Asia/Jakarta');
        setAttendanceConfig(res.data.attendanceConfig || null);
        setStaffList(res.data.staff || []);
        setTodayAttendances(res.data.attendances || []);

        // Default pilih staf pertama jika belum ada yang dipilih
        if (!selectedStaffId && res.data.staff?.length > 0) {
          setSelectedStaffId(res.data.staff[0].id);
        }
      } else {
        setErrorMsg(res.message || 'Gagal memuat absensi staf');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Koneksi gagal memuat data absensi');
    } finally {
      setLoading(false);
    }
  }, [activeOutlet?.id, selectedStaffId]);

  useEffect(() => {
    if (isOpen) {
      loadTodayData();
      setPin('');
      setNotes('');
      setSuccessMsg(null);
      setErrorMsg(null);
    }
  }, [isOpen, loadTodayData]);

  if (!isOpen) return null;

  const selectedStaff = staffList.find((s) => s.id === selectedStaffId) || null;
  const isClockedIn = !!selectedStaff?.currentAttendance?.isClockedIn;

  // Kalkulasi estimasi status ketepatan waktu untuk Clock In
  const calculateEstimatedStatus = () => {
    if (!attendanceConfig?.standardClockIn) return null;
    const [stdH, stdM] = attendanceConfig.standardClockIn.split(':').map((v) => parseInt(v, 10));
    if (isNaN(stdH) || isNaN(stdM)) return null;

    const localTimeStr = formatLocalTime(currentTime, false);
    const [curH, curM] = localTimeStr.split(':').map((v) => parseInt(v, 10));

    const stdTotal = stdH * 60 + stdM;
    const curTotal = curH * 60 + curM;
    const tolerance = attendanceConfig.lateToleranceMinutes ?? 15;
    const diff = curTotal - stdTotal;

    if (diff > tolerance) {
      return { isLate: true, lateMinutes: diff, tolerance };
    }
    return { isLate: false, lateMinutes: 0, tolerance };
  };

  const estimatedStatus = !isClockedIn ? calculateEstimatedStatus() : null;

  // Handle Submit Absen Masuk
  const handleClockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOutlet?.id || !selectedStaffId) return;

    if (selectedStaff?.hasPin && (!pin || pin.trim().length < 4)) {
      setErrorMsg('Masukkan PIN 4-6 digit staf yang valid.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await attendanceApi.clockIn({
        outletId: activeOutlet.id,
        userId: selectedStaffId,
        pin: pin.trim(),
        notes: notes.trim() || undefined,
      });

      if (res.status === 'success') {
        setSuccessMsg(res.message);
        setPin('');
        setNotes('');
        await loadTodayData();
      } else {
        setErrorMsg(res.message || 'Gagal melakukan absen masuk');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat absen masuk');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Submit Absen Pulang
  const handleClockOut = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOutlet?.id || !selectedStaffId) return;

    if (selectedStaff?.hasPin && (!pin || pin.trim().length < 4)) {
      setErrorMsg('Masukkan PIN 4-6 digit staf yang valid.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await attendanceApi.clockOut({
        outletId: activeOutlet.id,
        userId: selectedStaffId,
        pin: pin.trim(),
        notes: notes.trim() || undefined,
      });

      if (res.status === 'success') {
        setSuccessMsg(res.message);
        setPin('');
        setNotes('');
        await loadTodayData();
      } else {
        setErrorMsg(res.message || 'Gagal melakukan absen pulang');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat absen pulang');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col flex-1 min-h-0 max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
        {/* Sticky Header */}
        <div className="px-5 py-4 sm:px-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 text-blue-900 rounded-2xl">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
                Absensi Staf &amp; Jam Kerja
                <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                  {getTimezoneLabel(timezone)}
                </span>
              </h2>
              <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>{activeOutlet?.name || 'Outlet Aktif'}</span>
                <span>•</span>
                <span className="font-medium text-slate-700">{timezone}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Digital Clock Banner */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white px-5 py-3 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-blue-300 animate-pulse" />
            <div>
              <span className="text-xs text-blue-200 font-medium">Jam Lokal Toko ({getTimezoneLabel(timezone).split(' ')[0]})</span>
              <div className="text-xl sm:text-2xl font-black font-mono tracking-wider">
                {formatLocalTime(currentTime, true)}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-blue-200 flex items-center justify-end gap-1 font-medium">
              <Calendar className="w-3 h-3 text-blue-300" />
              {workDate || new Date().toISOString().slice(0, 10)}
            </span>
            {attendanceConfig?.standardClockIn && (
              <p className="text-[11px] text-blue-100 mt-0.5">
                Jadwal: <span className="font-bold">{attendanceConfig.standardClockIn}</span> (Toleransi: {attendanceConfig.lateToleranceMinutes ?? 15}m)
              </p>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 px-5 sm:px-6 bg-white shrink-0">
          <button
            onClick={() => setActiveTab('ACTION')}
            className={`py-3 px-4 font-bold text-xs sm:text-sm border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'ACTION'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>Catat Absen Staf</span>
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`py-3 px-4 font-bold text-xs sm:text-sm border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'HISTORY'
                ? 'border-blue-900 text-blue-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Daftar Kehadiran Hari Ini ({todayAttendances.length})</span>
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-800 text-xs animate-shake">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="flex-1 font-medium">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
              <div className="flex-1 font-bold">{successMsg}</div>
            </div>
          )}

          {activeTab === 'ACTION' && (
            <div className="space-y-4">
              {/* 1. Pilih Staf */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  1. Pilih Staf / Karyawan:
                </label>
                {loading ? (
                  <div className="py-6 text-center text-xs text-slate-400">Memuat daftar staf outlet...</div>
                ) : staffList.length === 0 ? (
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
                    Belum ada staf terdaftar di outlet ini. Tambahkan staf di menu Pengaturan Pengguna Backoffice.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {staffList.map((st) => {
                      const isSelected = st.id === selectedStaffId;
                      const isWorking = st.currentAttendance?.isClockedIn;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            setSelectedStaffId(st.id);
                            setPin('');
                            setErrorMsg(null);
                            setSuccessMsg(null);
                          }}
                          className={`p-3 rounded-2xl border text-left transition-all relative flex flex-col justify-between ${
                            isSelected
                              ? 'bg-blue-50/80 border-blue-900 ring-2 ring-blue-900/10'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                                {st.role}
                              </span>
                              {isWorking ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  Aktif
                                </span>
                              ) : st.currentAttendance?.clockOut ? (
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-200">
                                  Selesai
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-400">
                                  Belum
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-black text-slate-900 truncate">{st.name}</div>
                          </div>
                          {st.currentAttendance?.clockIn && (
                            <div className="text-[10px] text-slate-500 mt-2 font-mono">
                              Masuk:{' '}
                              <span className="font-bold text-slate-700">
                                {new Date(st.currentAttendance.clockIn).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  timeZone: timezone,
                                })}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. Informasi Status & Panel Aksi */}
              {selectedStaff && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black text-slate-900">{selectedStaff.name}</h4>
                      <p className="text-xs text-slate-500">
                        Peran: <span className="font-semibold text-slate-700">{selectedStaff.role}</span>
                        {selectedStaff.userCode ? ` • ID: ${selectedStaff.userCode}` : ''}
                      </p>
                    </div>

                    {isClockedIn ? (
                      <div className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border border-emerald-200">
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Sedang Bekerja</span>
                      </div>
                    ) : (
                      <div className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-xl text-xs font-extrabold flex items-center gap-1.5">
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Belum Masuk</span>
                      </div>
                    )}
                  </div>

                  {/* Status Preview Keterlambatan saat Clock In */}
                  {!isClockedIn && estimatedStatus && (
                    <div
                      className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
                        estimatedStatus.isLate
                          ? 'bg-amber-50 border-amber-200 text-amber-900'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {estimatedStatus.isLate ? (
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                        <div>
                          <div className="font-bold">
                            {estimatedStatus.isLate
                              ? `Status: Terlambat ${estimatedStatus.lateMinutes} Menit`
                              : 'Status: Tepat Waktu'}
                          </div>
                          <div className="text-[11px] opacity-80">
                            Jadwal standar masuk:{' '}
                            <span className="font-semibold">{attendanceConfig?.standardClockIn}</span> (Toleransi:{' '}
                            {estimatedStatus.tolerance} menit)
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Info sesi aktif saat Clock Out */}
                  {isClockedIn && selectedStaff.currentAttendance && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center justify-between">
                      <div>
                        <div className="font-bold">Sesi Kerja Aktif Hari Ini</div>
                        <div className="text-[11px] text-blue-700">
                          Absen masuk pukul:{' '}
                          <span className="font-bold font-mono">
                            {new Date(selectedStaff.currentAttendance.clockIn).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: timezone,
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-blue-600 font-bold block">Status Masuk</span>
                        <span
                          className={`text-xs font-black uppercase ${
                            selectedStaff.currentAttendance.status === 'LATE'
                              ? 'text-amber-600'
                              : 'text-emerald-700'
                          }`}
                        >
                          {selectedStaff.currentAttendance.status === 'LATE'
                            ? `Terlambat (${selectedStaff.currentAttendance.lateMinutes}m)`
                            : 'Tepat Waktu'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Form Input PIN & Catatan */}
                  <form onSubmit={isClockedIn ? handleClockOut : handleClockIn} className="space-y-3 pt-2">
                    {selectedStaff.hasPin && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-blue-900" />
                          <span>Verifikasi PIN Staf (4-6 Digit):</span>
                        </label>
                        <input
                          type="password"
                          inputMode="numeric"
                          maxLength={6}
                          value={pin}
                          onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="Masukkan PIN staf..."
                          className="w-full px-4 py-2.5 text-center font-mono tracking-widest text-lg font-black bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900"
                          autoFocus
                          required
                        />
                        <p className="text-[11px] text-slate-500 mt-1">
                          Masukkan PIN rahasia untuk memverifikasi absensi Anda secara mandiri.
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-600" />
                        <span>Catatan {estimatedStatus?.isLate ? 'Keterlambatan / Tugas' : 'Tambahan'} (Opsional):</span>
                      </label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder={
                          estimatedStatus?.isLate
                            ? 'Contoh: Terjebak macet, ban bocor, tugas luar...'
                            : isClockedIn
                            ? 'Contoh: Serah terima shift kasir selesai...'
                            : 'Catatan tugas hari ini...'
                        }
                        className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900"
                      />
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {activeTab === 'HISTORY' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
                <span>Catatan absensi tercatat pada {workDate}</span>
                <span className="font-bold text-slate-700">{todayAttendances.length} sesi</span>
              </div>

              {todayAttendances.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-500">
                  Belum ada catatan absensi masuk pada hari ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {todayAttendances.map((att) => {
                    const inTime = new Date(att.clockIn).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: timezone,
                    });
                    const outTime = att.clockOut
                      ? new Date(att.clockOut).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: timezone,
                        })
                      : 'Sedang Kerja';

                    const durationHrs = att.durationMinutes ? Math.floor(att.durationMinutes / 60) : 0;
                    const durationMins = att.durationMinutes ? att.durationMinutes % 60 : 0;

                    return (
                      <div
                        key={att.id}
                        className="p-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between text-xs hover:border-slate-300 transition-colors"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-900">{att.user?.name || 'Staf'}</span>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                              {att.user?.role}
                            </span>
                            <span
                              className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                                att.status === 'LATE'
                                  ? 'bg-amber-100 text-amber-800'
                                  : att.status === 'EARLY_LEAVE'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {att.status === 'LATE'
                                ? `Terlambat ${att.lateMinutes}m`
                                : att.status === 'EARLY_LEAVE'
                                ? 'Pulang Awal'
                                : 'Tepat Waktu'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 font-mono">
                            Masuk: <span className="font-bold text-slate-800">{inTime}</span> • Pulang:{' '}
                            <span className="font-bold text-slate-800">{outTime}</span>
                          </div>
                          {att.notes && (
                            <div className="text-[11px] text-slate-600 italic mt-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-100 inline-block">
                              "{att.notes}"
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-medium">Durasi Kerja</span>
                          <span className="font-bold text-slate-800 text-xs font-mono">
                            {att.durationMinutes ? `${durationHrs}j ${durationMins}m` : 'Aktif'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Action Footer (Pola Kanonikal PWA & iPhone Safe-Area) */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Tutup
          </button>

          {activeTab === 'ACTION' && selectedStaff && (
            <div className="flex items-center gap-2">
              {isClockedIn ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleClockOut}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-black rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{submitting ? 'Memproses...' : 'Absen Pulang (Selesai Bekerja)'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleClockIn}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-black rounded-xl shadow-sm transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{submitting ? 'Memproses...' : 'Catat Absen Masuk'}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
