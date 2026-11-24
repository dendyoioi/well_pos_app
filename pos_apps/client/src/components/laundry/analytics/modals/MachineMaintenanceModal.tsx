/**
 * Machine Maintenance Modal
 * Laundry Outlet Performance Intelligence (Well POS) - Wave 2
 * 
 * Form modal kanonikal untuk pencatatan riwayat servis & perbaikan mesin cuci/pengering,
 * sinkronisasi status mesin laundry, pelacakan downtime, dan audit biaya teknisi.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Wrench,
  Plus,
  Trash2,
  CheckCircle2,
  ChevronDown,
  FileText,
} from 'lucide-react';
import { CurrencyInput } from '../../../ui/CurrencyInput';
import { TablePagination } from '../../../TablePagination';
import { useDialog } from '../../../../context/DialogContext';
import { api } from '../../../../services/api';
import {
  fetchMachineMaintenanceLogs,
  createMachineMaintenanceLog,
  updateMachineMaintenanceLog,
  deleteMachineMaintenanceLog,
} from '../../../../services/laundryAnalyticsApi';
import type {
  LaundryMachineMaintenanceLogItem,
} from '../../../../types/laundryAnalytics';
import type { LaundryMachine } from '../../../../types/laundry';

export interface MachineMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOutletId?: string | null;
  outlets?: Array<{ id: string; name: string }>;
  userRole?: string;
  onSuccess?: () => void;
}

const SERVICE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  ROUTINE: { label: 'Servis Rutin', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  REPAIR: { label: 'Perbaikan', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  EMERGENCY: { label: 'Darurat / Rusak', color: 'bg-rose-50 text-rose-700 border-rose-200' },
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  SCHEDULED: { label: 'Terjadwal', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  IN_PROGRESS: { label: 'Sedang Servis', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  COMPLETED: { label: 'Selesai', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-rose-100 text-rose-800 border-rose-300' },
};

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

export const MachineMaintenanceModal: React.FC<MachineMaintenanceModalProps> = ({
  isOpen,
  onClose,
  activeOutletId,
  outlets = [],
  userRole = 'SUPERVISOR',
  onSuccess,
}) => {
  const dialog = useDialog();
  const isSupervisor = userRole === 'SUPERVISOR';
  const canManageCosts = userRole === 'OWNER' || userRole === 'ADMIN';

  // Tab mode: 'FORM' | 'HISTORY'
  const [activeTab, setActiveTab] = useState<'FORM' | 'HISTORY'>('FORM');

  // Outlet & Machine selection
  const [outletId, setOutletId] = useState<string>('');
  const [machines, setMachines] = useState<LaundryMachine[]>([]);
  const [loadingMachines, setLoadingMachines] = useState<boolean>(false);

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [machineId, setMachineId] = useState<string>('');
  const [serviceType, setServiceType] = useState<string>('ROUTINE');
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().slice(0, 16)
  );
  const [endDate, setEndDate] = useState<string>('');
  const [downtimeMinutes, setDowntimeMinutes] = useState<number>(0);
  const [technicianName, setTechnicianName] = useState<string>('');
  const [cost, setCost] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [status, setStatus] = useState<string>('IN_PROGRESS');
  const [submitting, setSubmitting] = useState<boolean>(false);

  // History State
  const [logs, setLogs] = useState<LaundryMachineMaintenanceLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalItems, setTotalItems] = useState<number>(0);

  // Inisialisasi outlet default saat modal dibuka
  useEffect(() => {
    if (isOpen) {
      if (activeOutletId && activeOutletId !== 'ALL') {
        setOutletId(activeOutletId);
      } else if (outlets.length > 0) {
        setOutletId(outlets[0].id);
      }
    }
  }, [isOpen, activeOutletId, outlets]);

  // Fetch daftar mesin laundry untuk outlet terpilih
  const loadMachines = useCallback(async () => {
    if (!outletId) return;
    try {
      setLoadingMachines(true);
      const res = await api.getLaundryMachines(outletId);
      const list = Array.isArray(res.data) ? res.data : [];
      setMachines(list);
      if (list.length > 0 && !machineId) {
        setMachineId(list[0].id);
      }
    } catch {
      setMachines([]);
    } finally {
      setLoadingMachines(false);
    }
  }, [outletId, machineId]);

  useEffect(() => {
    if (isOpen && outletId) {
      loadMachines();
    }
  }, [isOpen, outletId, loadMachines]);

  // Load maintenance logs
  const loadLogs = useCallback(async () => {
    if (!isOpen) return;
    try {
      setLoadingLogs(true);
      const res = await fetchMachineMaintenanceLogs({
        outletId: outletId && outletId !== 'ALL' ? outletId : undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        page: currentPage,
        limit: pageSize,
      });

      setLogs(res.items || []);
      setTotalItems(res.pagination?.totalItems || 0);
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal memuat riwayat servis mesin', 'error');
    } finally {
      setLoadingLogs(false);
    }
  }, [isOpen, outletId, statusFilter, currentPage, pageSize, dialog]);

  useEffect(() => {
    if (isOpen && activeTab === 'HISTORY') {
      loadLogs();
    }
  }, [isOpen, activeTab, loadLogs]);

  const resetForm = () => {
    setEditingId(null);
    setServiceType('ROUTINE');
    setStartDate(new Date().toISOString().slice(0, 16));
    setEndDate('');
    setDowntimeMinutes(0);
    setTechnicianName('');
    setCost(0);
    setNotes('');
    setStatus('IN_PROGRESS');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!machineId) {
      dialog.toast('Harap pilih mesin yang diservis', 'error');
      return;
    }

    try {
      setSubmitting(true);
      if (editingId) {
        await updateMachineMaintenanceLog(editingId, {
          serviceType,
          startDate,
          endDate: endDate ? endDate : null,
          downtimeMinutes: downtimeMinutes > 0 ? downtimeMinutes : undefined,
          technicianName,
          cost: canManageCosts ? cost : undefined,
          notes,
          status,
        });
        dialog.toast('Log perbaikan mesin berhasil diperbarui!', 'success');
      } else {
        await createMachineMaintenanceLog({
          outletId,
          machineId,
          serviceType,
          startDate,
          endDate: endDate ? endDate : undefined,
          downtimeMinutes: downtimeMinutes > 0 ? downtimeMinutes : undefined,
          technicianName,
          cost: canManageCosts ? cost : 0,
          notes,
          status,
        });
        dialog.toast('Log perbaikan mesin berhasil dicatat!', 'success');
      }

      resetForm();
      setActiveTab('HISTORY');
      loadLogs();
      loadMachines();
      onSuccess?.();
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal menyimpan log perbaikan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Aksi cepat "Selesaikan Servis"
  const handleCompleteService = async (item: LaundryMachineMaintenanceLogItem) => {
    const confirmed = await dialog.confirm({
      title: 'Selesaikan Servis Mesin',
      message: `Konfirmasi bahwa perbaikan untuk ${item.machine?.name || 'mesin'} telah selesai? Status mesin akan otomatis kembali AKTIF.`,
      confirmText: 'Ya, Selesaikan',
      cancelText: 'Batal',
      variant: 'success',
    });

    if (!confirmed) return;

    try {
      const nowIso = new Date().toISOString();
      await updateMachineMaintenanceLog(item.id, {
        status: 'COMPLETED',
        endDate: nowIso,
      });

      dialog.toast(`Servis untuk ${item.machine?.name || 'mesin'} telah selesai!`, 'success');
      loadLogs();
      loadMachines();
      onSuccess?.();
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal menyelesaikan servis mesin', 'error');
    }
  };

  const handleDeleteInline = async (item: LaundryMachineMaintenanceLogItem) => {
    if (isSupervisor) {
      dialog.toast('Supervisor tidak memiliki wewenang menghapus catatan log', 'error');
      return;
    }

    const confirmed = await dialog.confirm({
      title: 'Hapus Log Servis Mesin',
      message: `Hapus catatan riwayat servis untuk ${item.machine?.name || 'mesin'}?`,
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
      variant: 'danger',
    });

    if (!confirmed) return;

    try {
      await deleteMachineMaintenanceLog(item.id);
      dialog.toast('Log servis mesin berhasil dihapus', 'success');
      loadLogs();
      loadMachines();
      onSuccess?.();
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal menghapus log servis', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in">
      <div className="w-full sm:max-w-4xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-black">
              <Wrench className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm">Log Servis &amp; Pemeliharaan Mesin</h3>
              <p className="text-xs text-slate-500">
                Pencatatan downtime, sinkronisasi status mesin laundry, dan audit teknisi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('FORM')}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'FORM'
                ? 'bg-white text-blue-900 border-t border-x border-slate-200 shadow-2xs font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Catat Servis Mesin</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('HISTORY');
              setCurrentPage(1);
            }}
            className={`px-4 py-2 text-xs font-bold rounded-t-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'HISTORY'
                ? 'bg-white text-blue-900 border-t border-x border-slate-200 shadow-2xs font-black'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Riwayat Pemeliharaan</span>
          </button>
        </div>

        {/* Body Scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 bg-white">
          {activeTab === 'FORM' ? (
            <form id="machine-maintenance-form" onSubmit={handleSubmit} className="space-y-4 max-w-2xl mx-auto">
              {/* Outlet & Mesin */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Outlet / Cabang <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={outletId}
                      onChange={(e) => setOutletId(e.target.value)}
                      required
                      className="w-full appearance-none pr-10 pl-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none transition-colors"
                    >
                      {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pilih Mesin Laundry <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={machineId}
                      onChange={(e) => setMachineId(e.target.value)}
                      required
                      disabled={loadingMachines}
                      className="w-full appearance-none pr-10 pl-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none transition-colors disabled:opacity-50"
                    >
                      {machines.length === 0 ? (
                        <option value="">(Tidak ada mesin aktif)</option>
                      ) : (
                        machines.map((m) => (
                          <option key={m.id} value={m.id}>
                            [{m.code}] {m.name} ({m.machineType === 'WASHER' ? 'Cuci' : 'Kering'} - {m.status})
                          </option>
                        ))
                      )}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              {/* Tipe Servis & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Tipe Servis <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={serviceType}
                      onChange={(e) => setServiceType(e.target.value)}
                      required
                      className="w-full appearance-none pr-10 pl-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none transition-colors"
                    >
                      <option value="ROUTINE">Servis Rutin / Berkala</option>
                      <option value="REPAIR">Perbaikan Kerusakan</option>
                      <option value="EMERGENCY">Darurat / Mogok Total</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Status Servis <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      required
                      className="w-full appearance-none pr-10 pl-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none transition-colors"
                    >
                      <option value="SCHEDULED">Terjadwal (Belum Mulai)</option>
                      <option value="IN_PROGRESS">Sedang Servis (Mesin Rusak/Off)</option>
                      <option value="COMPLETED">Selesai (Mesin Siap Aktif)</option>
                      <option value="CANCELLED">Dibatalkan</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>

              {/* Waktu Mulai & Waktu Selesai */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Waktu Mulai Servis <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Waktu Selesai Servis (Opsional)
                  </label>
                  <input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Downtime & Nama Teknisi */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Estimasi / Aktual Downtime (Menit)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={downtimeMinutes || ''}
                    onChange={(e) => setDowntimeMinutes(parseInt(e.target.value) || 0)}
                    placeholder="Contoh: 120 (2 Jam)"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Kosongkan jika ingin sistem menghitung otomatis dari selisih waktu selesai - mulai.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Teknisi / Vendor Servis
                  </label>
                  <input
                    type="text"
                    value={technicianName}
                    onChange={(e) => setTechnicianName(e.target.value)}
                    placeholder="Contoh: Pak Herman (Teknisi Mesin)"
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none"
                  />
                </div>
              </div>

              {/* Biaya Servis (Khusus OWNER / ADMIN) */}
              {canManageCosts && (
                <div>
                  <CurrencyInput
                    label="Biaya Servis / Sparepart (Rp)"
                    value={cost}
                    onChange={(numericVal) => setCost(numericVal)}
                    placeholder="0"
                    helperText="Biaya perbaikan teknisi atau penggantian suku cadang mesin"
                  />
                </div>
              )}

              {/* Catatan Perbaikan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Gejala / Detail Perbaikan
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Suara berdecit saat putaran spin, ganti v-belt dan bantalan laher dinamo."
                  rows={3}
                  className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 text-slate-800 focus:bg-white focus:border-blue-900 focus:outline-none transition-colors"
                />
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Filter Status:</span>
                  <div className="relative flex-1 sm:w-48">
                    <select
                      value={statusFilter}
                      onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-full appearance-none pr-10 pl-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none"
                    >
                      <option value="ALL">Semua Status</option>
                      <option value="IN_PROGRESS">Sedang Servis</option>
                      <option value="SCHEDULED">Terjadwal</option>
                      <option value="COMPLETED">Selesai</option>
                      <option value="CANCELLED">Dibatalkan</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div className="text-xs font-bold text-slate-600">
                  Total Log: <span className="text-blue-900 font-black">{totalItems} Riwayat</span>
                </div>
              </div>

              {/* Table List */}
              {loadingLogs ? (
                <div className="py-12 text-center text-xs font-semibold text-slate-400 animate-pulse">
                  Memuat data riwayat servis mesin...
                </div>
              ) : logs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-medium border border-dashed border-slate-200 rounded-2xl">
                  Belum ada log perbaikan mesin yang tercatat.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-3.5">Mesin</th>
                        <th className="py-3 px-3">Tipe Servis</th>
                        <th className="py-3 px-3">Status</th>
                        <th className="py-3 px-3">Waktu Mulai</th>
                        <th className="py-3 px-3">Downtime</th>
                        <th className="py-3 px-3">Teknisi</th>
                        {canManageCosts && <th className="py-3 px-3">Biaya</th>}
                        <th className="py-3 px-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {logs.map((item) => {
                        const typeMeta = SERVICE_TYPE_LABELS[item.serviceType] || SERVICE_TYPE_LABELS.ROUTINE;
                        const statusMeta = STATUS_LABELS[item.status] || STATUS_LABELS.SCHEDULED;
                        const isUndergoingService = item.status === 'IN_PROGRESS' || item.status === 'SCHEDULED';

                        return (
                          <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-3.5 whitespace-nowrap">
                              <div className="font-bold text-slate-900">{item.machine?.name || 'Mesin'}</div>
                              <div className="text-[10px] text-slate-400">Kode: {item.machine?.code || '-'}</div>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${typeMeta.color}`}
                              >
                                {typeMeta.label}
                              </span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusMeta.color}`}
                              >
                                {statusMeta.label}
                              </span>
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                              {new Date(item.startDate).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap text-slate-700 font-semibold">
                              {item.downtimeMinutes > 0 ? `${item.downtimeMinutes} menit` : '-'}
                            </td>
                            <td className="py-3 px-3 whitespace-nowrap text-slate-600">
                              {item.technicianName || '-'}
                            </td>
                            {canManageCosts && (
                              <td className="py-3 px-3 whitespace-nowrap font-black text-slate-900">
                                {item.cost !== undefined ? formatRupiah(Number(item.cost)) : '-'}
                              </td>
                            )}
                            <td className="py-3 px-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5">
                                {isUndergoingService && (
                                  <button
                                    type="button"
                                    onClick={() => handleCompleteService(item)}
                                    className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors cursor-pointer inline-flex items-center gap-1"
                                    title="Selesaikan Servis & Aktifkan Mesin"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Selesai</span>
                                  </button>
                                )}
                                {!isSupervisor && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteInline(item)}
                                    className="p-1 rounded-lg hover:bg-rose-50 text-rose-600 transition-colors cursor-pointer"
                                    title="Hapus Log"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Canonical Pagination */}
              {totalItems > 0 && (
                <TablePagination
                  currentPage={currentPage}
                  pageSize={pageSize}
                  totalItems={totalItems}
                  onPageChange={(page) => setCurrentPage(page)}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                  itemLabel="log servis"
                />
              )}
            </div>
          )}
        </div>

        {/* Sticky Action Footer */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
          >
            Tutup
          </button>

          {activeTab === 'FORM' && (
            <button
              type="submit"
              form="machine-maintenance-form"
              disabled={submitting}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-900 hover:bg-blue-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50 shadow-sm"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Log Servis'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
export default MachineMaintenanceModal;
