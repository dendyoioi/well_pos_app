import React, { useState, useEffect, useMemo } from 'react';
import {
  Trash2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Coffee,
  X,
} from 'lucide-react';
import { attendanceApi, api } from '../../services/api';
import type { WorkShiftTemplate, StaffWorkSchedule } from '../../types/laundry';
import type { User } from '../../types/auth';

interface StaffShiftScheduleViewProps {
  activeOutletId: string;
  currentUser: User;
}

type ScheduleMode = 'WEEKLY' | 'MONTHLY' | 'DAILY';

export const StaffShiftScheduleView: React.FC<StaffShiftScheduleViewProps> = ({
  activeOutletId,
  currentUser,
}) => {
  const isSupervisorOrAbove = ['OWNER', 'ADMIN', 'SUPERVISOR'].includes(currentUser.role);

  const [mode, setMode] = useState<ScheduleMode>('WEEKLY');
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [templates, setTemplates] = useState<WorkShiftTemplate[]>([]);
  const [schedules, setSchedules] = useState<StaffWorkSchedule[]>([]);
  const [staffList, setStaffList] = useState<Array<{ id: string; name: string; role: string; userCode?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Template Modal State
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkShiftTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    startTime: '08:00',
    endTime: '17:00',
    graceMinutes: 10,
    colorHex: '#1E3A8A',
  });
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Auto-Schedule Modal State
  const [autoModalOpen, setAutoModalOpen] = useState(false);
  const [autoStartDate, setAutoStartDate] = useState('');
  const [autoEndDate, setAutoEndDate] = useState('');
  const [autoSelectedTemplates, setAutoSelectedTemplates] = useState<string[]>([]);
  const [autoMinStaff, setAutoMinStaff] = useState(1);
  const [autoOffDays, setAutoOffDays] = useState(1);
  const [autoOverwrite, setAutoOverwrite] = useState(false);
  const [generatingAuto, setGeneratingAuto] = useState(false);

  // Quick Cell Edit State
  const [editingCell, setEditingCell] = useState<{
    staffId: string;
    staffName: string;
    dateStr: string;
    currentSchedule?: StaffWorkSchedule;
  } | null>(null);
  const [cellShiftId, setCellShiftId] = useState<string>('');
  const [cellIsOff, setCellIsOff] = useState(false);
  const [cellNotes, setCellNotes] = useState('');
  const [savingCell, setSavingCell] = useState(false);

  // Hitung rentang tanggal kalender berdasarkan mode (Weekly / Monthly / Daily)
  const dateRange = useMemo(() => {
    const dates: string[] = [];
    const base = new Date(currentDate);

    if (mode === 'DAILY') {
      dates.push(base.toISOString().slice(0, 10));
    } else if (mode === 'WEEKLY') {
      // Mulai dari Senin
      const day = base.getDay();
      const diff = base.getDate() - day + (day === 0 ? -6 : 1);
      const startMonday = new Date(base.setDate(diff));
      for (let i = 0; i < 7; i++) {
        const d = new Date(startMonday);
        d.setDate(startMonday.getDate() + i);
        dates.push(d.toISOString().slice(0, 10));
      }
    } else {
      // Monthly: seluruh hari dalam bulan ini
      const year = base.getFullYear();
      const month = base.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();
      for (let i = 1; i <= lastDay; i++) {
        const d = new Date(year, month, i);
        dates.push(d.toISOString().slice(0, 10));
      }
    }
    return dates;
  }, [currentDate, mode]);

  const startDateStr = dateRange[0] || '';
  const endDateStr = dateRange[dateRange.length - 1] || '';

  const fetchData = async () => {
    if (!activeOutletId) return;
    setLoading(true);
    try {
      const [tmplRes, schedRes, usersRes] = await Promise.all([
        attendanceApi.getWorkShiftTemplates(activeOutletId),
        attendanceApi.getStaffWorkSchedules({
          outletId: activeOutletId,
          startDate: startDateStr,
          endDate: endDateStr,
          userId: isSupervisorOrAbove ? undefined : currentUser.id,
        }),
        api.getUsers().catch(() => ({ status: 'error', data: [] })),
      ]);

      if (tmplRes.status === 'success' && Array.isArray(tmplRes.data)) {
        setTemplates(tmplRes.data);
      }
      if (schedRes.status === 'success' && Array.isArray(schedRes.data)) {
        setSchedules(schedRes.data);
      }
      if (usersRes.status === 'success' && Array.isArray(usersRes.data)) {
        setStaffList(usersRes.data.filter((u: any) => u.isActive));
      }
    } catch (err: any) {
      console.error('Error fetching shift schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeOutletId, startDateStr, endDateStr]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handlePrev = () => {
    const next = new Date(currentDate);
    if (mode === 'DAILY') next.setDate(next.getDate() - 1);
    else if (mode === 'WEEKLY') next.setDate(next.getDate() - 7);
    else next.setMonth(next.getMonth() - 1);
    setCurrentDate(next);
  };

  const handleNext = () => {
    const next = new Date(currentDate);
    if (mode === 'DAILY') next.setDate(next.getDate() + 1);
    else if (mode === 'WEEKLY') next.setDate(next.getDate() + 7);
    else next.setMonth(next.getMonth() + 1);
    setCurrentDate(next);
  };

  const handleOpenAutoSchedule = () => {
    setAutoStartDate(startDateStr);
    setAutoEndDate(endDateStr);
    setAutoSelectedTemplates(templates.map((t) => t.id));
    setAutoMinStaff(1);
    setAutoOffDays(1);
    setAutoOverwrite(false);
    setAutoModalOpen(true);
  };

  const handleRunAutoSchedule = async () => {
    if (!autoStartDate || !autoEndDate) {
      showToast('Rentang tanggal wajib diisi', 'error');
      return;
    }
    if (autoSelectedTemplates.length === 0) {
      showToast('Pilih minimal 1 template shift', 'error');
      return;
    }

    setGeneratingAuto(true);
    try {
      const res = await attendanceApi.autoGenerateStaffWorkSchedules({
        outletId: activeOutletId,
        startDate: autoStartDate,
        endDate: autoEndDate,
        shiftTemplateIds: autoSelectedTemplates,
        minStaffPerShift: autoMinStaff,
        offDaysPerWeek: autoOffDays,
        overwriteExisting: autoOverwrite,
      });

      if (res.status === 'success') {
        showToast(res.message || 'Jadwal otomatis berhasil digenerate');
        setAutoModalOpen(false);
        fetchData();
      } else {
        showToast(res.message || 'Gagal generate jadwal', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setGeneratingAuto(false);
    }
  };

  const handleOpenCellEdit = (staff: { id: string; name: string }, dateStr: string) => {
    if (!isSupervisorOrAbove) return;
    const existing = schedules.find((s) => s.userId === staff.id && s.scheduleDate === dateStr);
    setEditingCell({
      staffId: staff.id,
      staffName: staff.name,
      dateStr,
      currentSchedule: existing,
    });
    setCellShiftId(existing?.shiftTemplateId || (templates[0]?.id || ''));
    setCellIsOff(existing?.isOffDay || false);
    setCellNotes(existing?.notes || '');
  };

  const handleSaveCellSchedule = async () => {
    if (!editingCell) return;
    setSavingCell(true);
    try {
      const res = await attendanceApi.bulkUpsertStaffWorkSchedules({
        outletId: activeOutletId,
        schedules: [
          {
            userId: editingCell.staffId,
            scheduleDate: editingCell.dateStr,
            shiftTemplateId: cellIsOff ? null : cellShiftId || null,
            isOffDay: cellIsOff,
            notes: cellNotes.trim() || null,
          },
        ],
      });

      if (res.status === 'success') {
        showToast('Jadwal kerja berhasil diperbarui');
        setEditingCell(null);
        fetchData();
      } else {
        showToast(res.message || 'Gagal menyimpan jadwal', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setSavingCell(false);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTemplate(true);
    try {
      let res;
      if (editingTemplate) {
        res = await attendanceApi.updateWorkShiftTemplate(editingTemplate.id, {
          name: templateForm.name,
          startTime: templateForm.startTime,
          endTime: templateForm.endTime,
          graceMinutes: Number(templateForm.graceMinutes),
          colorHex: templateForm.colorHex,
        });
      } else {
        res = await attendanceApi.createWorkShiftTemplate({
          outletId: activeOutletId,
          name: templateForm.name,
          startTime: templateForm.startTime,
          endTime: templateForm.endTime,
          graceMinutes: Number(templateForm.graceMinutes),
          colorHex: templateForm.colorHex,
        });
      }

      if (res.status === 'success') {
        showToast(editingTemplate ? 'Template diperbarui' : 'Template dibuat');
        setEditingTemplate(null);
        setTemplateForm({ name: '', startTime: '08:00', endTime: '17:00', graceMinutes: 10, colorHex: '#1E3A8A' });
        // Refresh templates
        const tmplRes = await attendanceApi.getWorkShiftTemplates(activeOutletId);
        if (tmplRes.status === 'success') setTemplates(tmplRes.data);
      } else {
        showToast(res.message || 'Gagal menyimpan template', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan', 'error');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menonaktifkan/menghapus template ini?')) return;
    try {
      const res = await attendanceApi.deleteWorkShiftTemplate(id);
      if (res.status === 'success') {
        showToast(res.message || 'Template berhasil dihapus');
        const tmplRes = await attendanceApi.getWorkShiftTemplates(activeOutletId);
        if (tmplRes.status === 'success') setTemplates(tmplRes.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menghapus template', 'error');
    }
  };

  // Helper tampilan format tanggal kolom
  const formatColumnHeader = (dateStr: string) => {
    const d = new Date(dateStr);
    const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
    const dayNum = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    return { dayName, dayNum };
  };

  // Staf yang ditampilkan: jika role operasional, hanya dirinya
  const visibleStaff = useMemo(() => {
    if (!isSupervisorOrAbove) {
      return staffList.filter((s) => s.id === currentUser.id);
    }
    return staffList;
  }, [staffList, isSupervisorOrAbove, currentUser.id]);

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            {(['WEEKLY', 'MONTHLY', 'DAILY'] as ScheduleMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  mode === m ? 'bg-white text-blue-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {m === 'WEEKLY' ? 'Mingguan' : m === 'MONTHLY' ? 'Bulanan' : 'Harian'}
              </button>
            ))}
          </div>

          {/* Navigasi Tanggal */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-slate-800 px-2 min-w-[130px] text-center">
              {mode === 'MONTHLY'
                ? currentDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
                : `${new Date(startDateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} - ${new Date(
                    endDateStr
                  ).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`}
            </span>
            <button
              type="button"
              onClick={handleNext}
              className="p-1 rounded-lg text-slate-500 hover:bg-slate-200 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action Buttons (Khusus Supervisor / Owner) */}
        {isSupervisorOrAbove && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => setTemplateModalOpen(true)}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-2xs flex items-center gap-1.5"
            >
              <Wrench className="w-4 h-4 text-slate-500" />
              <span>Kelola Template</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAutoSchedule}
              className="px-4 py-2 text-xs font-extrabold text-white bg-blue-900 hover:bg-blue-800 rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-blue-200" />
              <span>Auto-Jadwalkan</span>
            </button>
          </div>
        )}
      </div>

      {/* Matriks Kalender Jadwal Shift */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-blue-900 mb-2" />
            <p className="text-xs">Memuat roster jadwal kerja...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="p-3.5 text-xs font-bold text-slate-700 uppercase tracking-wider sticky left-0 bg-slate-50 z-10 w-48 border-r border-slate-200">
                    Karyawan
                  </th>
                  {dateRange.map((dStr) => {
                    const { dayName, dayNum } = formatColumnHeader(dStr);
                    const isToday = dStr === new Date().toISOString().slice(0, 10);
                    return (
                      <th
                        key={dStr}
                        className={`p-2.5 text-center border-r border-slate-200 text-xs min-w-[100px] ${
                          isToday ? 'bg-blue-50/70' : ''
                        }`}
                      >
                        <div className={`font-black uppercase text-[11px] ${isToday ? 'text-blue-900' : 'text-slate-500'}`}>
                          {dayName}
                        </div>
                        <div className={`font-mono text-xs font-bold ${isToday ? 'text-blue-950 font-black' : 'text-slate-700'}`}>
                          {dayNum}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleStaff.length === 0 ? (
                  <tr>
                    <td colSpan={dateRange.length + 1} className="py-12 text-center text-slate-400 text-xs">
                      Tidak ada karyawan yang ditemukan di outlet ini
                    </td>
                  </tr>
                ) : (
                  visibleStaff.map((staff) => (
                    <tr key={staff.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Kolom Staf */}
                      <td className="p-3.5 sticky left-0 bg-white hover:bg-slate-50/60 z-10 border-r border-slate-200">
                        <div className="font-bold text-xs text-slate-900 truncate">{staff.name}</div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <span className="px-1.5 py-0.2 rounded bg-slate-100 font-mono font-medium">
                            {staff.role}
                          </span>
                          {staff.userCode && <span>#{staff.userCode}</span>}
                        </div>
                      </td>

                      {/* Kolom Tanggal */}
                      {dateRange.map((dStr) => {
                        const sched = schedules.find((s) => s.userId === staff.id && s.scheduleDate === dStr);
                        const isToday = dStr === new Date().toISOString().slice(0, 10);

                        return (
                          <td
                            key={dStr}
                            onClick={() => handleOpenCellEdit(staff, dStr)}
                            className={`p-1.5 border-r border-slate-100 text-center transition-all ${
                              isSupervisorOrAbove ? 'cursor-pointer hover:bg-blue-50/40' : ''
                            } ${isToday ? 'bg-blue-50/30' : ''}`}
                          >
                            {sched ? (
                              sched.isOffDay ? (
                                <div className="p-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-[11px] font-bold">
                                  <Coffee className="w-3.5 h-3.5 mx-auto mb-0.5 text-slate-400" />
                                  <span>LIBUR</span>
                                </div>
                              ) : (
                                <div
                                  style={{
                                    borderColor: sched.shiftTemplate?.colorHex || '#1E3A8A',
                                    backgroundColor: `${sched.shiftTemplate?.colorHex || '#1E3A8A'}15`,
                                    color: sched.shiftTemplate?.colorHex || '#1E3A8A',
                                  }}
                                  className="p-1.5 rounded-xl border text-[11px] font-black shadow-2xs"
                                >
                                  <div className="truncate">{sched.shiftTemplate?.name || 'Shift'}</div>
                                  <div className="font-mono text-[10px] font-semibold mt-0.5">
                                    {sched.shiftTemplate?.startTime} - {sched.shiftTemplate?.endTime}
                                  </div>
                                </div>
                              )
                            ) : (
                              <div className="py-2 text-[11px] text-slate-300 font-medium border border-dashed border-slate-200 rounded-xl hover:border-slate-300">
                                {isSupervisorOrAbove ? '+ Atur' : '-'}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Quick Edit Shift Cell */}
      {editingCell && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-sm text-slate-800">Ubah Jadwal Kerja</h4>
                <p className="text-xs text-slate-500">
                  {editingCell.staffName} • {new Date(editingCell.dateStr).toLocaleDateString('id-ID', { dateStyle: 'full' })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Opsi Libur vs Kerja */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCellIsOff(false)}
                className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                  !cellIsOff ? 'bg-blue-900 text-white border-transparent' : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                Masuk Kerja
              </button>
              <button
                type="button"
                onClick={() => setCellIsOff(true)}
                className={`flex-1 py-2 text-xs font-bold rounded-xl border transition-all ${
                  cellIsOff ? 'bg-slate-800 text-white border-transparent' : 'bg-slate-50 text-slate-600 border-slate-200'
                }`}
              >
                Libur (OFF)
              </button>
            </div>

            {/* Pilihan Shift Template */}
            {!cellIsOff && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Shift</label>
                <div className="space-y-2">
                  {templates.map((tmpl) => {
                    const isSelected = cellShiftId === tmpl.id;
                    return (
                      <button
                        key={tmpl.id}
                        type="button"
                        onClick={() => setCellShiftId(tmpl.id)}
                        className={`w-full p-2.5 rounded-xl border text-left text-xs font-bold flex items-center justify-between transition-all ${
                          isSelected
                            ? 'border-blue-900 ring-2 ring-blue-900 bg-blue-50/50 text-blue-950'
                            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: tmpl.colorHex }}
                          />
                          <span>{tmpl.name}</span>
                        </div>
                        <span className="font-mono text-[11px] text-slate-500">
                          {tmpl.startTime} - {tmpl.endTime}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Catatan Shift */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Tambahan (Opsional)</label>
              <input
                type="text"
                value={cellNotes}
                onChange={(e) => setCellNotes(e.target.value)}
                placeholder="Contoh: Menggantikan shift pagi"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-900"
              />
            </div>

            {/* Tombol Aksi */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveCellSchedule}
                disabled={savingCell}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                {savingCell && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Simpan Jadwal</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Master Template Shift */}
      {templateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-bold text-sm text-slate-800">Master Template Shift Kerja</h4>
              <button
                type="button"
                onClick={() => {
                  setTemplateModalOpen(false);
                  setEditingTemplate(null);
                }}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Tambah/Ubah Template */}
            <form onSubmit={handleSaveTemplate} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="text-xs font-bold text-slate-800">
                {editingTemplate ? 'Edit Template Shift' : 'Tambah Template Shift Baru'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Nama Shift</label>
                  <input
                    type="text"
                    required
                    value={templateForm.name}
                    onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                    placeholder="Contoh: Shift Pagi"
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Warna Label</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={templateForm.colorHex}
                      onChange={(e) => setTemplateForm({ ...templateForm, colorHex: e.target.value })}
                      className="w-8 h-8 rounded-lg cursor-pointer border-0"
                    />
                    <span className="font-mono text-xs text-slate-600">{templateForm.colorHex}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jam Masuk (HH:mm)</label>
                  <input
                    type="time"
                    required
                    value={templateForm.startTime}
                    onChange={(e) => setTemplateForm({ ...templateForm, startTime: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Jam Pulang (HH:mm)</label>
                  <input
                    type="time"
                    required
                    value={templateForm.endTime}
                    onChange={(e) => setTemplateForm({ ...templateForm, endTime: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Toleransi Terlambat (Menit)</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={templateForm.graceMinutes}
                    onChange={(e) => setTemplateForm({ ...templateForm, graceMinutes: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                {editingTemplate && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTemplate(null);
                      setTemplateForm({ name: '', startTime: '08:00', endTime: '17:00', graceMinutes: 10, colorHex: '#1E3A8A' });
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl"
                  >
                    Batal Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingTemplate}
                  className="px-4 py-1.5 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-xl flex items-center gap-1 shadow-sm"
                >
                  {savingTemplate && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingTemplate ? 'Simpan Perubahan' : 'Tambah Template'}</span>
                </button>
              </div>
            </form>

            {/* Daftar Template Aktif */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-700">Daftar Template Aktif ({templates.length})</div>
              {templates.map((tmpl) => (
                <div
                  key={tmpl.id}
                  className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: tmpl.colorHex }} />
                    <div>
                      <span className="font-bold text-xs text-slate-800">{tmpl.name}</span>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {tmpl.startTime} - {tmpl.endTime} (Toleransi: {tmpl.graceMinutes}m)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTemplate(tmpl);
                        setTemplateForm({
                          name: tmpl.name,
                          startTime: tmpl.startTime,
                          endTime: tmpl.endTime,
                          graceMinutes: tmpl.graceMinutes,
                          colorHex: tmpl.colorHex,
                        });
                      }}
                      className="p-1.5 text-slate-500 hover:text-blue-900 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(tmpl.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Auto-Jadwal Shift */}
      {autoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-900" />
                <h4 className="font-bold text-sm text-slate-800">Auto-Jadwalkan Shift</h4>
              </div>
              <button
                type="button"
                onClick={() => setAutoModalOpen(false)}
                className="p-1.5 rounded-full text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              Sistem akan membagi shift secara merata, mengacak jatah hari libur mingguan, dan mencegah penugasan shift pagi langsung setelah shift malam.
            </p>

            {/* Rentang Tanggal */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mulai</label>
                <input
                  type="date"
                  value={autoStartDate}
                  onChange={(e) => setAutoStartDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Sampai</label>
                <input
                  type="date"
                  value={autoEndDate}
                  onChange={(e) => setAutoEndDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 font-mono"
                />
              </div>
            </div>

            {/* Template Shift yang Dipakai */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Shift yang Digunakan</label>
              <div className="space-y-1.5">
                {templates.map((tmpl) => {
                  const isChecked = autoSelectedTemplates.includes(tmpl.id);
                  return (
                    <label
                      key={tmpl.id}
                      className="p-2 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-semibold cursor-pointer hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setAutoSelectedTemplates([...autoSelectedTemplates, tmpl.id]);
                            } else {
                              setAutoSelectedTemplates(autoSelectedTemplates.filter((id) => id !== tmpl.id));
                            }
                          }}
                          className="rounded text-blue-900 focus:ring-blue-900"
                        />
                        <span>{tmpl.name}</span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-400">
                        {tmpl.startTime} - {tmpl.endTime}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Konfigurasi Kuota & Libur */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Min Staf / Shift</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={autoMinStaff}
                  onChange={(e) => setAutoMinStaff(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Hari Libur / Minggu</label>
                <input
                  type="number"
                  min="0"
                  max="3"
                  value={autoOffDays}
                  onChange={(e) => setAutoOffDays(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-slate-200 font-mono"
                />
              </div>
            </div>

            {/* Toggle Timpa Jadwal Eksisting */}
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={autoOverwrite}
                onChange={(e) => setAutoOverwrite(e.target.checked)}
                className="rounded text-blue-900 focus:ring-blue-900"
              />
              <span>Timpa jadwal yang sudah ada sebelumnya</span>
            </label>

            {/* Tombol Eksekusi */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAutoModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRunAutoSchedule}
                disabled={generatingAuto}
                className="px-5 py-2 text-xs font-extrabold text-white bg-blue-900 hover:bg-blue-800 rounded-xl flex items-center gap-1.5 shadow-sm"
              >
                {generatingAuto && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Generate Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold animate-in fade-in transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
              : 'bg-rose-950 text-rose-100 border-rose-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};
