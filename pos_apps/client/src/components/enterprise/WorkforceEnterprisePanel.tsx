import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Clock,
  Calendar,
  Banknote,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  AlertCircle,
  X,
  ChevronDown,
  FileText,
} from 'lucide-react';
import { enterpriseCore4Api, api } from '../../services/api';
import type {
  StaffOvertimeRecord,
  StaffLeaveRecord,
  StaffPayrollSlipRecord,
  PayrollSummary,
} from '../../types/enterprise_core4';
import type { Outlet } from '../../types/outlet';
import type { User as AuthUser } from '../../types/auth';
import { formatRupiah } from '../../utils/currency';
import { CurrencyInput } from '../ui/CurrencyInput';

interface WorkforceEnterprisePanelProps {
  activeOutlet?: Outlet | null;
  currentUser?: AuthUser | null;
}

type WorkforceTab = 'OVERTIME' | 'LEAVE' | 'PAYROLL';

export const WorkforceEnterprisePanel: React.FC<WorkforceEnterprisePanelProps> = ({
  activeOutlet,
  currentUser,
}) => {
  const isManager = ['OWNER', 'ADMIN', 'SUPERVISOR'].includes(currentUser?.role || '');
  const isOwnerAdmin = ['OWNER', 'ADMIN'].includes(currentUser?.role || '');

  // Sub-tab
  const [activeTab, setActiveTab] = useState<WorkforceTab>('OVERTIME');

  // Supporting users list
  const [staffUsers, setStaffUsers] = useState<any[]>([]);

  // ----------------------------------------------------
  // 1. OVERTIME STATES
  // ----------------------------------------------------
  const [overtimeList, setOvertimeList] = useState<StaffOvertimeRecord[]>([]);
  const [overtimeLoading, setOvertimeLoading] = useState<boolean>(false);
  const [overtimeStatusFilter, setOvertimeStatusFilter] = useState<string>('ALL');
  const [overtimeSearch, setOvertimeSearch] = useState<string>('');

  // Overtime Modal
  const [overtimeModalOpen, setOvertimeModalOpen] = useState<boolean>(false);
  const [submittingOvertime, setSubmittingOvertime] = useState<boolean>(false);
  const [overtimeError, setOvertimeError] = useState<string | null>(null);
  const [otUserId, setOtUserId] = useState<string>(currentUser?.id || '');
  const [otWorkDate, setOtWorkDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [otHours, setOtHours] = useState<number>(2);
  const [otHourlyRate, setOtHourlyRate] = useState<number>(25000);
  const [otReason, setOtReason] = useState<string>('');

  // Overtime Approval / Reject Modal
  const [actionOtModal, setActionOtModal] = useState<{
    open: boolean;
    type: 'APPROVE' | 'REJECT';
    record: StaffOvertimeRecord | null;
    reason: string;
    submitting: boolean;
    error: string | null;
  }>({
    open: false,
    type: 'APPROVE',
    record: null,
    reason: '',
    submitting: false,
    error: null,
  });

  // ----------------------------------------------------
  // 2. LEAVE STATES
  // ----------------------------------------------------
  const [leaveList, setLeaveList] = useState<StaffLeaveRecord[]>([]);
  const [leaveLoading, setLeaveLoading] = useState<boolean>(false);
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<string>('ALL');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<string>('ALL');

  // Leave Modal
  const [leaveModalOpen, setLeaveModalOpen] = useState<boolean>(false);
  const [submittingLeave, setSubmittingLeave] = useState<boolean>(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [leaveUserId, setLeaveUserId] = useState<string>(currentUser?.id || '');
  const [leaveType, setLeaveType] = useState<string>('ANNUAL');
  const [leaveStartDate, setLeaveStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [leaveEndDate, setLeaveEndDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState<string>('');

  // Leave Approval / Reject Modal
  const [actionLeaveModal, setActionLeaveModal] = useState<{
    open: boolean;
    type: 'APPROVE' | 'REJECT';
    record: StaffLeaveRecord | null;
    reason: string;
    submitting: boolean;
    error: string | null;
  }>({
    open: false,
    type: 'APPROVE',
    record: null,
    reason: '',
    submitting: false,
    error: null,
  });

  // ----------------------------------------------------
  // 3. PAYROLL STATES
  // ----------------------------------------------------
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [payrollYear, setPayrollYear] = useState<number>(currentYear);
  const [payrollMonth, setPayrollMonth] = useState<number>(currentMonth);
  const [payrollSlips, setPayrollSlips] = useState<StaffPayrollSlipRecord[]>([]);
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary>({
    totalSlips: 0,
    totalGross: 0,
    totalDeductions: 0,
    totalNetSalary: 0,
    totalPaidCount: 0,
  });
  const [payrollLoading, setPayrollLoading] = useState<boolean>(false);

  // Generate Payroll Modal
  const [genPayrollModalOpen, setGenPayrollModalOpen] = useState<boolean>(false);
  const [generatingPayroll, setGeneratingPayroll] = useState<boolean>(false);
  const [genPayrollError, setGenPayrollError] = useState<string | null>(null);
  const [genUserId, setGenUserId] = useState<string>('');
  const [genBaseSalary, setGenBaseSalary] = useState<number>(3500000);
  const [genAllowances, setGenAllowances] = useState<number>(0);
  const [genCommissionPay, setGenCommissionPay] = useState<number>(0);
  const [genBonusAmount, setGenBonusAmount] = useState<number>(0);
  const [genCashAdvanceDeduction, setGenCashAdvanceDeduction] = useState<number>(0);
  const [genOtherDeduction, setGenOtherDeduction] = useState<number>(0);
  const [genAutoPullOvertime, setGenAutoPullOvertime] = useState<boolean>(true);
  const [genAutoPullCashAdvance, setGenAutoPullCashAdvance] = useState<boolean>(true);
  const [genNotes, setGenNotes] = useState<string>('');

  // Payroll Status Transition Modal (Finalize / Pay)
  const [statusSlipModal, setStatusSlipModal] = useState<{
    open: boolean;
    targetStatus: 'FINALIZED' | 'PAID';
    record: StaffPayrollSlipRecord | null;
    paymentMethod: string;
    paymentReference: string;
    notes: string;
    submitting: boolean;
    error: string | null;
  }>({
    open: false,
    targetStatus: 'FINALIZED',
    record: null,
    paymentMethod: 'BANK_TRANSFER',
    paymentReference: '',
    notes: '',
    submitting: false,
    error: null,
  });

  // Slip Detail Modal
  const [selectedSlipDetail, setSelectedSlipDetail] = useState<StaffPayrollSlipRecord | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ----------------------------------------------------
  // DATA FETCHING
  // ----------------------------------------------------
  const loadStaffUsers = useCallback(async () => {
    try {
      const res = await api.getUsers();
      if (res.status === 'success' && Array.isArray(res.data)) {
        setStaffUsers(res.data);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }, []);

  const loadOvertimes = useCallback(async () => {
    setOvertimeLoading(true);
    try {
      const params: any = {};
      if (activeOutlet?.id) params.outletId = activeOutlet.id;
      if (overtimeStatusFilter !== 'ALL') params.status = overtimeStatusFilter;
      const res = await enterpriseCore4Api.getOvertimeRequests(params);
      if (res.status === 'success' && Array.isArray(res.data)) {
        setOvertimeList(res.data);
      }
    } catch (err) {
      console.error('Failed to load overtimes:', err);
    } finally {
      setOvertimeLoading(false);
    }
  }, [activeOutlet?.id, overtimeStatusFilter]);

  const loadLeaves = useCallback(async () => {
    setLeaveLoading(true);
    try {
      const params: any = {};
      if (activeOutlet?.id) params.outletId = activeOutlet.id;
      if (leaveStatusFilter !== 'ALL') params.status = leaveStatusFilter;
      const res = await enterpriseCore4Api.getLeaveRequests(params);
      if (res.status === 'success' && Array.isArray(res.data)) {
        setLeaveList(res.data);
      }
    } catch (err) {
      console.error('Failed to load leaves:', err);
    } finally {
      setLeaveLoading(false);
    }
  }, [activeOutlet?.id, leaveStatusFilter]);

  const loadPayroll = useCallback(async () => {
    setPayrollLoading(true);
    try {
      const params: any = {
        periodYear: payrollYear,
        periodMonth: payrollMonth,
      };
      if (activeOutlet?.id) params.outletId = activeOutlet.id;
      const res = await enterpriseCore4Api.getPayrollSlips(params);
      if (res.status === 'success' && Array.isArray(res.data)) {
        setPayrollSlips(res.data);
        if (res.summary) setPayrollSummary(res.summary);
      }
    } catch (err) {
      console.error('Failed to load payroll:', err);
    } finally {
      setPayrollLoading(false);
    }
  }, [activeOutlet?.id, payrollYear, payrollMonth]);

  useEffect(() => {
    loadStaffUsers();
  }, [loadStaffUsers]);

  useEffect(() => {
    if (activeTab === 'OVERTIME') {
      loadOvertimes();
    } else if (activeTab === 'LEAVE') {
      loadLeaves();
    } else if (activeTab === 'PAYROLL') {
      loadPayroll();
    }
  }, [activeTab, loadOvertimes, loadLeaves, loadPayroll]);

  // Filtered overtimes
  const filteredOvertimes = useMemo(() => {
    return overtimeList.filter((item) => {
      if (overtimeSearch.trim()) {
        const query = overtimeSearch.toLowerCase();
        const userName = item.user?.name?.toLowerCase() || '';
        const reason = item.reason?.toLowerCase() || '';
        if (!userName.includes(query) && !reason.includes(query)) return false;
      }
      return true;
    });
  }, [overtimeList, overtimeSearch]);

  // Filtered leaves
  const filteredLeaves = useMemo(() => {
    return leaveList.filter((item) => {
      if (leaveTypeFilter !== 'ALL' && item.leaveType !== leaveTypeFilter) return false;
      return true;
    });
  }, [leaveList, leaveTypeFilter]);

  // ----------------------------------------------------
  // OVERTIME ACTIONS
  // ----------------------------------------------------
  const handleOpenCreateOvertime = () => {
    setOvertimeError(null);
    setOtUserId(currentUser?.id || (staffUsers[0]?.id || ''));
    setOtWorkDate(new Date().toISOString().slice(0, 10));
    setOtHours(2);
    setOtHourlyRate(25000);
    setOtReason('');
    setOvertimeModalOpen(true);
  };

  const handleSaveOvertime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOutlet?.id) {
      setOvertimeError('Pilih outlet aktif terlebih dahulu');
      return;
    }
    if (!otUserId) {
      setOvertimeError('Pilih karyawan yang mengajukan lembur');
      return;
    }
    if (!otHours || otHours <= 0) {
      setOvertimeError('Durasi lembur harus lebih dari 0 jam');
      return;
    }

    setSubmittingOvertime(true);
    setOvertimeError(null);
    try {
      const res = await enterpriseCore4Api.createOvertimeRequest({
        outletId: activeOutlet.id,
        userId: otUserId,
        workDate: otWorkDate,
        hours: Number(otHours),
        hourlyRate: Number(otHourlyRate) || 25000,
        reason: otReason.trim() || undefined,
      });

      if (res.status === 'success') {
        showToast('Pengajuan lembur berhasil dicatat!');
        setOvertimeModalOpen(false);
        loadOvertimes();
      } else {
        setOvertimeError(res.message || 'Gagal mengajukan lembur');
      }
    } catch (err: any) {
      setOvertimeError(err?.message || 'Terjadi kesalahan sistem saat mengajukan lembur');
    } finally {
      setSubmittingOvertime(false);
    }
  };

  const handleExecuteOtAction = async () => {
    if (!actionOtModal.record) return;
    if (actionOtModal.type === 'REJECT' && !actionOtModal.reason.trim()) {
      setActionOtModal((prev) => ({ ...prev, error: 'Alasan penolakan wajib diisi' }));
      return;
    }

    setActionOtModal((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      let res;
      if (actionOtModal.type === 'APPROVE') {
        res = await enterpriseCore4Api.reviewOvertimeRequest(actionOtModal.record.id, {
          status: 'APPROVED',
        });
      } else {
        res = await enterpriseCore4Api.reviewOvertimeRequest(actionOtModal.record.id, {
          status: 'REJECTED',
          rejectionReason: actionOtModal.reason.trim(),
        });
      }

      if (res.status === 'success') {
        showToast(
          `Pengajuan lembur berhasil ${
            actionOtModal.type === 'APPROVE' ? 'disetujui' : 'ditolak'
          }!`
        );
        setActionOtModal((prev) => ({ ...prev, open: false }));
        loadOvertimes();
      } else {
        setActionOtModal((prev) => ({ ...prev, error: res.message || 'Gagal memproses aksi' }));
      }
    } catch (err: any) {
      setActionOtModal((prev) => ({
        ...prev,
        error: err?.message || 'Terjadi kesalahan saat memproses aksi',
      }));
    } finally {
      setActionOtModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // ----------------------------------------------------
  // LEAVE ACTIONS
  // ----------------------------------------------------
  const handleOpenCreateLeave = () => {
    setLeaveError(null);
    setLeaveUserId(currentUser?.id || (staffUsers[0]?.id || ''));
    setLeaveType('ANNUAL');
    const today = new Date().toISOString().slice(0, 10);
    setLeaveStartDate(today);
    setLeaveEndDate(today);
    setLeaveReason('');
    setLeaveModalOpen(true);
  };

  const calculatedLeaveDays = useMemo(() => {
    if (!leaveStartDate || !leaveEndDate) return 1;
    const start = new Date(leaveStartDate);
    const end = new Date(leaveEndDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return diff > 0 ? diff : 1;
  }, [leaveStartDate, leaveEndDate]);

  const handleSaveLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOutlet?.id) {
      setLeaveError('Pilih outlet aktif terlebih dahulu');
      return;
    }
    if (!leaveUserId) {
      setLeaveError('Pilih karyawan yang mengajukan cuti');
      return;
    }
    if (!leaveStartDate || !leaveEndDate) {
      setLeaveError('Tentukan tanggal mulai dan selesai cuti');
      return;
    }

    setSubmittingLeave(true);
    setLeaveError(null);
    try {
      const res = await enterpriseCore4Api.createLeaveRequest({
        outletId: activeOutlet.id,
        userId: leaveUserId,
        leaveType,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        reason: leaveReason.trim() || undefined,
      });

      if (res.status === 'success') {
        showToast('Pengajuan cuti/izin berhasil diajukan!');
        setLeaveModalOpen(false);
        loadLeaves();
      } else {
        setLeaveError(res.message || 'Gagal mengajukan cuti');
      }
    } catch (err: any) {
      setLeaveError(err?.message || 'Terjadi kesalahan sistem saat mengajukan cuti');
    } finally {
      setSubmittingLeave(false);
    }
  };

  const handleExecuteLeaveAction = async () => {
    if (!actionLeaveModal.record) return;
    if (actionLeaveModal.type === 'REJECT' && !actionLeaveModal.reason.trim()) {
      setActionLeaveModal((prev) => ({ ...prev, error: 'Alasan penolakan wajib diisi' }));
      return;
    }

    setActionLeaveModal((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      let res;
      if (actionLeaveModal.type === 'APPROVE') {
        res = await enterpriseCore4Api.reviewLeaveRequest(actionLeaveModal.record.id, {
          status: 'APPROVED',
        });
      } else {
        res = await enterpriseCore4Api.reviewLeaveRequest(actionLeaveModal.record.id, {
          status: 'REJECTED',
          rejectionReason: actionLeaveModal.reason.trim(),
        });
      }

      if (res.status === 'success') {
        showToast(
          `Pengajuan cuti berhasil ${
            actionLeaveModal.type === 'APPROVE' ? 'disetujui' : 'ditolak'
          }!`
        );
        setActionLeaveModal((prev) => ({ ...prev, open: false }));
        loadLeaves();
      } else {
        setActionLeaveModal((prev) => ({ ...prev, error: res.message || 'Gagal memproses aksi' }));
      }
    } catch (err: any) {
      setActionLeaveModal((prev) => ({
        ...prev,
        error: err?.message || 'Terjadi kesalahan saat memproses aksi',
      }));
    } finally {
      setActionLeaveModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  // ----------------------------------------------------
  // PAYROLL ACTIONS
  // ----------------------------------------------------
  const handleOpenGenPayroll = () => {
    setGenPayrollError(null);
    setGenUserId(staffUsers[0]?.id || '');
    setGenBaseSalary(3500000);
    setGenAllowances(0);
    setGenCommissionPay(0);
    setGenBonusAmount(0);
    setGenCashAdvanceDeduction(0);
    setGenOtherDeduction(0);
    setGenAutoPullOvertime(true);
    setGenAutoPullCashAdvance(true);
    setGenNotes('');
    setGenPayrollModalOpen(true);
  };

  const handleGeneratePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOutlet?.id) {
      setGenPayrollError('Pilih outlet aktif terlebih dahulu');
      return;
    }
    if (!genUserId) {
      setGenPayrollError('Pilih karyawan untuk slip gaji');
      return;
    }

    setGeneratingPayroll(true);
    setGenPayrollError(null);
    try {
      const res = await enterpriseCore4Api.generatePayrollSlip({
        outletId: activeOutlet.id,
        userId: genUserId,
        periodYear: payrollYear,
        periodMonth: payrollMonth,
        baseSalary: Number(genBaseSalary) || 0,
        allowances: Number(genAllowances) || 0,
        commissionPay: Number(genCommissionPay) || 0,
        bonusAmount: Number(genBonusAmount) || 0,
        cashAdvanceDeduction: genAutoPullCashAdvance && Number(genCashAdvanceDeduction) <= 0 ? undefined : Number(genCashAdvanceDeduction) || 0,
        otherDeduction: Number(genOtherDeduction) || 0,
        autoPullOvertime: genAutoPullOvertime,
        autoPullCashAdvance: genAutoPullCashAdvance,
        notes: genNotes.trim() || undefined,
      });

      if (res.status === 'success') {
        showToast('Slip gaji berhasil digenerate!');
        setGenPayrollModalOpen(false);
        loadPayroll();
      } else {
        setGenPayrollError(res.message || 'Gagal mengenerate slip gaji');
      }
    } catch (err: any) {
      setGenPayrollError(err?.message || 'Terjadi kesalahan saat mengenerate slip gaji');
    } finally {
      setGeneratingPayroll(false);
    }
  };

  const handleUpdateSlipStatus = async () => {
    if (!statusSlipModal.record) return;

    setStatusSlipModal((prev) => ({ ...prev, submitting: true, error: null }));
    try {
      const payload: any = {
        status: statusSlipModal.targetStatus,
      };
      if (statusSlipModal.targetStatus === 'PAID') {
        payload.paymentMethod = statusSlipModal.paymentMethod;
        payload.paymentReference = statusSlipModal.paymentReference.trim() || undefined;
        payload.paidAt = new Date().toISOString();
      }
      if (statusSlipModal.notes.trim()) {
        payload.notes = statusSlipModal.notes.trim();
      }

      const res = await enterpriseCore4Api.updatePayrollSlipStatus(
        statusSlipModal.record.id,
        payload
      );

      if (res.status === 'success') {
        showToast(
          `Status slip gaji berhasil diperbarui ke ${
            statusSlipModal.targetStatus === 'PAID' ? 'Lunas (PAID)' : 'Finalisasi (FINALIZED)'
          }!`
        );
        setStatusSlipModal((prev) => ({ ...prev, open: false }));
        loadPayroll();
      } else {
        setStatusSlipModal((prev) => ({ ...prev, error: res.message || 'Gagal update status slip' }));
      }
    } catch (err: any) {
      setStatusSlipModal((prev) => ({
        ...prev,
        error: err?.message || 'Terjadi kesalahan saat update status slip',
      }));
    } finally {
      setStatusSlipModal((prev) => ({ ...prev, submitting: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl border border-slate-700 text-sm animate-in fade-in slide-in-from-bottom-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sub-tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('OVERTIME')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'OVERTIME'
                ? 'bg-blue-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Lembur (Overtime)</span>
          </button>
          <button
            onClick={() => setActiveTab('LEAVE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'LEAVE'
                ? 'bg-blue-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Cuti & Izin</span>
          </button>
          <button
            onClick={() => setActiveTab('PAYROLL')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'PAYROLL'
                ? 'bg-blue-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>Rekap Slip Gaji (Payroll)</span>
          </button>
        </div>

        {/* Action Buttons per Tab */}
        <div className="flex items-center gap-2 shrink-0">
          {activeTab === 'OVERTIME' && (
            <button
              onClick={handleOpenCreateOvertime}
              className="flex items-center gap-2 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Ajukan Lembur</span>
            </button>
          )}

          {activeTab === 'LEAVE' && (
            <button
              onClick={handleOpenCreateLeave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Ajukan Cuti/Izin</span>
            </button>
          )}

          {activeTab === 'PAYROLL' && isOwnerAdmin && (
            <button
              onClick={handleOpenGenPayroll}
              className="flex items-center gap-2 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white text-sm font-medium rounded-xl shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Generate Slip Gaji</span>
            </button>
          )}
        </div>
      </div>

      {/* ==================================================== */}
      {/* 1. OVERTIME TAB                                     */}
      {/* ==================================================== */}
      {activeTab === 'OVERTIME' && (
        <div className="space-y-4">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Total Pengajuan</span>
              <p className="text-xl font-bold text-slate-800 mt-1">{overtimeList.length}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-amber-600 font-medium">Menunggu Persetujuan</span>
              <p className="text-xl font-bold text-amber-700 mt-1">
                {overtimeList.filter((o) => o.status === 'PENDING').length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-emerald-600 font-medium">Jam Disetujui</span>
              <p className="text-xl font-bold text-emerald-700 mt-1">
                {overtimeList
                  .filter((o) => o.status === 'APPROVED')
                  .reduce((sum, o) => sum + Number(o.hours || 0), 0)}{' '}
                Jam
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-blue-700 font-medium">Estimasi Upah Disetujui</span>
              <p className="text-xl font-bold text-blue-900 mt-1">
                {formatRupiah(
                  overtimeList
                    .filter((o) => o.status === 'APPROVED')
                    .reduce((sum, o) => sum + Number(o.totalPay || o.estimatedPay || 0), 0)
                )}
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama karyawan atau alasan..."
                value={overtimeSearch}
                onChange={(e) => setOvertimeSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div className="relative shrink-0 sm:w-44">
              <select
                value={overtimeStatusFilter}
                onChange={(e) => setOvertimeStatusFilter(e.target.value)}
                className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
              >
                <option value="ALL">Semua Status</option>
                <option value="PENDING">Menunggu (Pending)</option>
                <option value="APPROVED">Disetujui (Approved)</option>
                <option value="REJECTED">Ditolak (Rejected)</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Overtime List */}
          {overtimeLoading ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
              Memuat data lembur...
            </div>
          ) : filteredOvertimes.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
              Tidak ada data pengajuan lembur yang sesuai.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Tanggal Lembur</th>
                      <th className="py-3 px-4">Karyawan</th>
                      <th className="py-3 px-4">Durasi</th>
                      <th className="py-3 px-4">Tarif/Jam</th>
                      <th className="py-3 px-4">Total Upah</th>
                      <th className="py-3 px-4">Alasan</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOvertimes.map((ot) => (
                      <tr key={ot.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-slate-800">
                          {new Date(ot.workDate).toLocaleDateString('id-ID', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-900">{ot.user?.name || '-'}</div>
                          <span className="text-xs text-slate-500 capitalize">
                            {ot.user?.role || 'Staff'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-800">{ot.hours} Jam</td>
                        <td className="py-3.5 px-4 text-slate-600">
                          {formatRupiah(ot.hourlyRate)}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {formatRupiah(ot.totalPay || ot.estimatedPay || 0)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                          {ot.reason || '-'}
                        </td>
                        <td className="py-3.5 px-4">
                          {ot.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" /> Menunggu
                            </span>
                          )}
                          {ot.status === 'APPROVED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Disetujui
                            </span>
                          )}
                          {ot.status === 'REJECTED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3" /> Ditolak
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {ot.status === 'PENDING' && isManager ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() =>
                                  setActionOtModal({
                                    open: true,
                                    type: 'APPROVE',
                                    record: ot,
                                    reason: '',
                                    submitting: false,
                                    error: null,
                                  })
                                }
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-all"
                              >
                                Setujui
                              </button>
                              <button
                                onClick={() =>
                                  setActionOtModal({
                                    open: true,
                                    type: 'REJECT',
                                    record: ot,
                                    reason: '',
                                    submitting: false,
                                    error: null,
                                  })
                                }
                                className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-medium rounded-lg border border-rose-200 transition-all"
                              >
                                Tolak
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 2. LEAVE TAB                                         */}
      {/* ==================================================== */}
      {activeTab === 'LEAVE' && (
        <div className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium">Total Pengajuan Cuti</span>
              <p className="text-xl font-bold text-slate-800 mt-1">{leaveList.length}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-amber-600 font-medium">Menunggu Persetujuan</span>
              <p className="text-xl font-bold text-amber-700 mt-1">
                {leaveList.filter((l) => l.status === 'PENDING').length}
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-emerald-600 font-medium">Cuti Disetujui (Hari)</span>
              <p className="text-xl font-bold text-emerald-700 mt-1">
                {leaveList
                  .filter((l) => l.status === 'APPROVED')
                  .reduce((sum, l) => sum + Number(l.totalDays || 0), 0)}{' '}
                Hari
              </p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-blue-700 font-medium">Izin Sakit Disetujui</span>
              <p className="text-xl font-bold text-blue-900 mt-1">
                {leaveList.filter((l) => l.status === 'APPROVED' && l.leaveType === 'SICK').length}
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative shrink-0 sm:w-48">
              <select
                value={leaveTypeFilter}
                onChange={(e) => setLeaveTypeFilter(e.target.value)}
                className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
              >
                <option value="ALL">Semua Jenis Cuti</option>
                <option value="ANNUAL">Cuti Tahunan (Annual)</option>
                <option value="SICK">Sakit (Sick Leave)</option>
                <option value="UNPAID">Izin Tanpa Gaji (Unpaid)</option>
                <option value="EMERGENCY">Darurat (Emergency)</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>
            <div className="relative shrink-0 sm:w-44">
              <select
                value={leaveStatusFilter}
                onChange={(e) => setLeaveStatusFilter(e.target.value)}
                className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
              >
                <option value="ALL">Semua Status</option>
                <option value="PENDING">Menunggu (Pending)</option>
                <option value="APPROVED">Disetujui (Approved)</option>
                <option value="REJECTED">Ditolak (Rejected)</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Leave List */}
          {leaveLoading ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
              Memuat data cuti & izin...
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
              Tidak ada data pengajuan cuti yang sesuai.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Periode Cuti</th>
                      <th className="py-3 px-4">Durasi</th>
                      <th className="py-3 px-4">Jenis Cuti</th>
                      <th className="py-3 px-4">Karyawan</th>
                      <th className="py-3 px-4">Alasan</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredLeaves.map((leave) => (
                      <tr key={leave.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 font-medium text-slate-800">
                          {new Date(leave.startDate).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                          })}{' '}
                          -{' '}
                          {new Date(leave.endDate).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          {leave.totalDays} Hari
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {leave.leaveType === 'ANNUAL' && 'Cuti Tahunan'}
                            {leave.leaveType === 'SICK' && 'Sakit'}
                            {leave.leaveType === 'UNPAID' && 'Izin / Tanpa Gaji'}
                            {leave.leaveType === 'EMERGENCY' && 'Darurat'}
                            {!['ANNUAL', 'SICK', 'UNPAID', 'EMERGENCY'].includes(leave.leaveType) &&
                              leave.leaveType}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-medium text-slate-900">{leave.user?.name || '-'}</div>
                          <span className="text-xs text-slate-500 capitalize">
                            {leave.user?.role || 'Staff'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">
                          {leave.reason || '-'}
                        </td>
                        <td className="py-3.5 px-4">
                          {leave.status === 'PENDING' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" /> Menunggu
                            </span>
                          )}
                          {leave.status === 'APPROVED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Disetujui
                            </span>
                          )}
                          {leave.status === 'REJECTED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200">
                              <XCircle className="w-3 h-3" /> Ditolak
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {leave.status === 'PENDING' && isManager ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() =>
                                  setActionLeaveModal({
                                    open: true,
                                    type: 'APPROVE',
                                    record: leave,
                                    reason: '',
                                    submitting: false,
                                    error: null,
                                  })
                                }
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg transition-all"
                              >
                                Setujui
                              </button>
                              <button
                                onClick={() =>
                                  setActionLeaveModal({
                                    open: true,
                                    type: 'REJECT',
                                    record: leave,
                                    reason: '',
                                    submitting: false,
                                    error: null,
                                  })
                                }
                                className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-medium rounded-lg border border-rose-200 transition-all"
                              >
                                Tolak
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* 3. PAYROLL TAB                                       */}
      {/* ==================================================== */}
      {activeTab === 'PAYROLL' && (
        <div className="space-y-4">
          {/* Period Selector & KPIs */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-700">Periode Gaji:</span>
              <div className="relative w-36">
                <select
                  value={payrollMonth}
                  onChange={(e) => setPayrollMonth(Number(e.target.value))}
                  className="w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {new Date(2026, m - 1, 1).toLocaleDateString('id-ID', { month: 'long' })}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
              </div>
              <div className="relative w-28">
                <select
                  value={payrollYear}
                  onChange={(e) => setPayrollYear(Number(e.target.value))}
                  className="w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
                >
                  {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="text-right">
                <span className="text-xs text-slate-500">Total Gaji Bersih</span>
                <p className="text-base font-bold text-blue-900">
                  {formatRupiah(payrollSummary.totalNetSalary || 0)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500">Status Lunas</span>
                <p className="text-base font-bold text-emerald-700">
                  {payrollSummary.totalPaidCount || 0} / {payrollSummary.totalSlips || 0} Slip
                </p>
              </div>
            </div>
          </div>

          {/* Payroll Slips Table */}
          {payrollLoading ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
              Memuat data slip gaji...
            </div>
          ) : payrollSlips.length === 0 ? (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center text-slate-500">
              Belum ada slip gaji yang digenerate untuk periode ini.
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Karyawan</th>
                      <th className="py-3 px-4">Gaji Pokok</th>
                      <th className="py-3 px-4">Lembur</th>
                      <th className="py-3 px-4">Komisi</th>
                      <th className="py-3 px-4">Bonus</th>
                      <th className="py-3 px-4">Potongan Kasbon</th>
                      <th className="py-3 px-4">Gaji Bersih</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payrollSlips.map((slip) => (
                      <tr key={slip.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">{slip.user?.name || '-'}</div>
                          <span className="text-xs text-slate-500 capitalize">
                            {slip.user?.role || 'Staff'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {formatRupiah(slip.baseSalary)}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {Number(slip.overtimePay) > 0 ? (
                            <span className="text-emerald-700 font-medium">
                              +{formatRupiah(slip.overtimePay)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {Number(slip.commissionPay) > 0 ? (
                            <span className="text-blue-700 font-medium">
                              +{formatRupiah(slip.commissionPay)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {Number(slip.bonusAmount) > 0 ? (
                            <span className="text-indigo-700 font-medium">
                              +{formatRupiah(slip.bonusAmount)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {Number(slip.cashAdvanceDeduction) > 0 || Number(slip.otherDeduction) > 0 ? (
                            <span className="text-rose-700 font-medium">
                              -
                              {formatRupiah(
                                Number(slip.cashAdvanceDeduction || 0) +
                                  Number(slip.otherDeduction || 0)
                              )}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {formatRupiah(slip.netSalary)}
                        </td>
                        <td className="py-3.5 px-4">
                          {slip.status === 'DRAFT' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              Draft
                            </span>
                          )}
                          {slip.status === 'FINALIZED' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              Final
                            </span>
                          )}
                          {slip.status === 'PAID' && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" /> Lunas
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedSlipDetail(slip)}
                              className="px-2 py-1 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-medium transition-all"
                            >
                              Detail
                            </button>

                            {isOwnerAdmin && slip.status === 'DRAFT' && (
                              <button
                                onClick={() =>
                                  setStatusSlipModal({
                                    open: true,
                                    targetStatus: 'FINALIZED',
                                    record: slip,
                                    paymentMethod: 'BANK_TRANSFER',
                                    paymentReference: '',
                                    notes: '',
                                    submitting: false,
                                    error: null,
                                  })
                                }
                                className="px-2.5 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-medium transition-all"
                              >
                                Finalisasi
                              </button>
                            )}

                            {isOwnerAdmin && slip.status === 'FINALIZED' && (
                              <button
                                onClick={() =>
                                  setStatusSlipModal({
                                    open: true,
                                    targetStatus: 'PAID',
                                    record: slip,
                                    paymentMethod: 'BANK_TRANSFER',
                                    paymentReference: '',
                                    notes: '',
                                    submitting: false,
                                    error: null,
                                  })
                                }
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-all"
                              >
                                Bayar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: AJUKAN LEMBUR                                 */}
      {/* ==================================================== */}
      {overtimeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col flex-1 min-h-0 bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92dvh] sm:max-h-[90vh] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Ajukan Lembur (Overtime)</h3>
                  <p className="text-xs text-slate-500">Pencatatan jam kerja lembur staf</p>
                </div>
              </div>
              <button
                onClick={() => setOvertimeModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSaveOvertime} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-4">
                {overtimeError && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{overtimeError}</span>
                  </div>
                )}

                {/* Karyawan */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Karyawan <span className="text-rose-500">*</span>
                  </label>
                  {isManager ? (
                    <div className="relative">
                      <select
                        value={otUserId}
                        onChange={(e) => setOtUserId(e.target.value)}
                        className="w-full pl-3 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
                      >
                        {staffUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  ) : (
                    <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 font-medium">
                      {currentUser?.name || 'Saya Sendiri'}
                    </div>
                  )}
                </div>

                {/* Tanggal Lembur */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tanggal Lembur <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={otWorkDate}
                    onChange={(e) => setOtWorkDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Durasi Jam */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Durasi (Jam) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={otHours}
                      onChange={(e) => setOtHours(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      required
                    />
                  </div>

                  {/* Tarif per Jam */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Tarif Dasar/Jam (Rp)
                    </label>
                    <CurrencyInput
                      value={otHourlyRate}
                      onChange={(val) => setOtHourlyRate(val)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>

                {/* Kalkulasi Preview */}
                <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center justify-between text-xs">
                  <span className="text-blue-900 font-medium">
                    Estimasi Upah ({otHours} jam × 1.5):
                  </span>
                  <span className="text-sm font-bold text-blue-900">
                    {formatRupiah(otHours * 1.5 * otHourlyRate)}
                  </span>
                </div>

                {/* Alasan */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alasan / Keterangan Lembur
                  </label>
                  <textarea
                    rows={2}
                    value={otReason}
                    onChange={(e) => setOtReason(e.target.value)}
                    placeholder="Contoh: Lonjakan cucian express akhir pekan, finishing bedcover"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setOvertimeModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingOvertime}
                  className="px-5 py-2 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
                >
                  {submittingOvertime ? 'Menyimpan...' : 'Kirim Pengajuan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: AJUKAN CUTI / IZIN                            */}
      {/* ==================================================== */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col flex-1 min-h-0 bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92dvh] sm:max-h-[90vh] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Ajukan Cuti & Izin</h3>
                  <p className="text-xs text-slate-500">Permohonan cuti tahunan atau izin sakit</p>
                </div>
              </div>
              <button
                onClick={() => setLeaveModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSaveLeave} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-4">
                {leaveError && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{leaveError}</span>
                  </div>
                )}

                {/* Karyawan */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Karyawan <span className="text-rose-500">*</span>
                  </label>
                  {isManager ? (
                    <div className="relative">
                      <select
                        value={leaveUserId}
                        onChange={(e) => setLeaveUserId(e.target.value)}
                        className="w-full pl-3 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
                      >
                        {staffUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  ) : (
                    <div className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 font-medium">
                      {currentUser?.name || 'Saya Sendiri'}
                    </div>
                  )}
                </div>

                {/* Tipe Cuti */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Jenis Cuti / Izin <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={leaveType}
                      onChange={(e) => setLeaveType(e.target.value)}
                      className="w-full pl-3 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
                    >
                      <option value="ANNUAL">Cuti Tahunan (Annual)</option>
                      <option value="SICK">Sakit (Sick Leave)</option>
                      <option value="UNPAID">Izin Tanpa Gaji (Unpaid)</option>
                      <option value="EMERGENCY">Darurat (Emergency)</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Tanggal Mulai & Selesai */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Mulai Tanggal <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={leaveStartDate}
                      onChange={(e) => setLeaveStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Sampai Tanggal <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={leaveEndDate}
                      onChange={(e) => setLeaveEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      required
                    />
                  </div>
                </div>

                {/* Total Hari Info */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-600 font-medium">Total Durasi Cuti:</span>
                  <span className="text-sm font-bold text-slate-800">
                    {calculatedLeaveDays} Hari Kerja
                  </span>
                </div>

                {/* Alasan */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Alasan / Keterangan Cuti
                  </label>
                  <textarea
                    rows={2}
                    value={leaveReason}
                    onChange={(e) => setLeaveReason(e.target.value)}
                    placeholder="Contoh: Keperluan keluarga, surat dokter terlampir"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setLeaveModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingLeave}
                  className="px-5 py-2 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
                >
                  {submittingLeave ? 'Mengajukan...' : 'Kirim Pengajuan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: ACTION APPROVE / REJECT OVERTIME OR LEAVE     */}
      {/* ==================================================== */}
      {actionOtModal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col flex-1 min-h-0 bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92dvh] sm:max-h-[90vh] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-slate-800">
                {actionOtModal.type === 'APPROVE' ? 'Setujui Lembur' : 'Tolak Lembur'}
              </h3>
              <button
                onClick={() => setActionOtModal((prev) => ({ ...prev, open: false }))}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-4">
              {actionOtModal.error && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionOtModal.error}</span>
                </div>
              )}
              <p className="text-sm text-slate-600">
                {actionOtModal.type === 'APPROVE'
                  ? `Apakah Anda yakin ingin menyetujui lembur untuk ${actionOtModal.record?.user?.name} (${actionOtModal.record?.hours} jam)?`
                  : `Berikan alasan penolakan pengajuan lembur untuk ${actionOtModal.record?.user?.name}:`}
              </p>
              {actionOtModal.type === 'REJECT' && (
                <textarea
                  rows={3}
                  value={actionOtModal.reason}
                  onChange={(e) =>
                    setActionOtModal((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="Alasan penolakan..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                  required
                />
              )}
            </div>
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActionOtModal((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2 text-sm font-medium text-slate-600"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteOtAction}
                disabled={actionOtModal.submitting}
                className={`px-5 py-2 text-white text-sm font-semibold rounded-xl shadow-sm transition-all ${
                  actionOtModal.type === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actionOtModal.submitting
                  ? 'Memproses...'
                  : actionOtModal.type === 'APPROVE'
                  ? 'Ya, Setujui'
                  : 'Tolak Lembur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {actionLeaveModal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col flex-1 min-h-0 bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92dvh] sm:max-h-[90vh] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-slate-800">
                {actionLeaveModal.type === 'APPROVE' ? 'Setujui Cuti' : 'Tolak Cuti'}
              </h3>
              <button
                onClick={() => setActionLeaveModal((prev) => ({ ...prev, open: false }))}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-4">
              {actionLeaveModal.error && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{actionLeaveModal.error}</span>
                </div>
              )}
              <p className="text-sm text-slate-600">
                {actionLeaveModal.type === 'APPROVE'
                  ? `Apakah Anda yakin ingin menyetujui permohonan cuti ${actionLeaveModal.record?.user?.name} (${actionLeaveModal.record?.totalDays} hari)?`
                  : `Berikan alasan penolakan permohonan cuti untuk ${actionLeaveModal.record?.user?.name}:`}
              </p>
              {actionLeaveModal.type === 'REJECT' && (
                <textarea
                  rows={3}
                  value={actionLeaveModal.reason}
                  onChange={(e) =>
                    setActionLeaveModal((prev) => ({ ...prev, reason: e.target.value }))
                  }
                  placeholder="Alasan penolakan..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                  required
                />
              )}
            </div>
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setActionLeaveModal((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2 text-sm font-medium text-slate-600"
              >
                Batal
              </button>
              <button
                onClick={handleExecuteLeaveAction}
                disabled={actionLeaveModal.submitting}
                className={`px-5 py-2 text-white text-sm font-semibold rounded-xl shadow-sm transition-all ${
                  actionLeaveModal.type === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actionLeaveModal.submitting
                  ? 'Memproses...'
                  : actionLeaveModal.type === 'APPROVE'
                  ? 'Ya, Setujui'
                  : 'Tolak Cuti'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: GENERATE SLIP GAJI                            */}
      {/* ==================================================== */}
      {genPayrollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col flex-1 min-h-0 bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92dvh] sm:max-h-[90vh] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Generate Slip Gaji</h3>
                  <p className="text-xs text-slate-500">
                    Periode{' '}
                    {new Date(2026, payrollMonth - 1, 1).toLocaleDateString('id-ID', {
                      month: 'long',
                    })}{' '}
                    {payrollYear}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setGenPayrollModalOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGeneratePayroll} className="flex flex-col flex-1 min-h-0">
              <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-4">
                {genPayrollError && (
                  <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{genPayrollError}</span>
                  </div>
                )}

                {/* Karyawan */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Karyawan <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={genUserId}
                      onChange={(e) => setGenUserId(e.target.value)}
                      className="w-full pl-3 pr-10 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
                      required
                    >
                      <option value="">-- Pilih Karyawan --</option>
                      {staffUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Gaji Pokok */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Gaji Pokok (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <CurrencyInput
                    value={genBaseSalary}
                    onChange={(val) => setGenBaseSalary(val)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                {/* Auto pull options */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={genAutoPullOvertime}
                      onChange={(e) => setGenAutoPullOvertime(e.target.checked)}
                      className="w-4 h-4 text-blue-900 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span>
                      Tarik otomatis upah <strong>Lembur (Overtime)</strong> yang telah disetujui
                    </span>
                  </label>
                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={genAutoPullCashAdvance}
                      onChange={(e) => setGenAutoPullCashAdvance(e.target.checked)}
                      className="w-4 h-4 text-blue-900 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span>
                      Tarik otomatis sisa cicilan <strong>Kasbon Karyawan</strong>
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Komisi Laundry (Rp)
                    </label>
                    <CurrencyInput
                      value={genCommissionPay}
                      onChange={(val) => setGenCommissionPay(val)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Bonus / Tunjangan (Rp)
                    </label>
                    <CurrencyInput
                      value={genBonusAmount}
                      onChange={(val) => setGenBonusAmount(val)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Potongan Kasbon Manual (Rp)
                    </label>
                    <CurrencyInput
                      value={genCashAdvanceDeduction}
                      onChange={(val) => setGenCashAdvanceDeduction(val)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Potongan Lainnya (Rp)
                    </label>
                    <CurrencyInput
                      value={genOtherDeduction}
                      onChange={(val) => setGenOtherDeduction(val)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </div>

                {/* Catatan */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan Slip
                  </label>
                  <input
                    type="text"
                    value={genNotes}
                    onChange={(e) => setGenNotes(e.target.value)}
                    placeholder="Contoh: Gaji bulanan reguler"
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>
              </div>

              {/* Sticky Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setGenPayrollModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={generatingPayroll}
                  className="px-5 py-2 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
                >
                  {generatingPayroll ? 'Mengenerate...' : 'Generate Slip'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: UPDATE SLIP STATUS (FINALIZE / PAY)           */}
      {/* ==================================================== */}
      {statusSlipModal.open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col flex-1 min-h-0 bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92dvh] sm:max-h-[90vh] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <h3 className="font-bold text-slate-800">
                {statusSlipModal.targetStatus === 'PAID'
                  ? 'Tandai Gaji Lunas (PAID)'
                  : 'Finalisasi Slip Gaji'}
              </h3>
              <button
                onClick={() => setStatusSlipModal((prev) => ({ ...prev, open: false }))}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-4">
              {statusSlipModal.error && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{statusSlipModal.error}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-xs text-slate-500">Karyawan:</span>
                <p className="font-semibold text-slate-800">
                  {statusSlipModal.record?.user?.name}
                </p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Total Gaji Bersih:</span>
                  <span className="font-bold text-blue-900">
                    {formatRupiah(statusSlipModal.record?.netSalary || 0)}
                  </span>
                </div>
              </div>

              {statusSlipModal.targetStatus === 'PAID' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Metode Pembayaran
                    </label>
                    <div className="relative">
                      <select
                        value={statusSlipModal.paymentMethod}
                        onChange={(e) =>
                          setStatusSlipModal((prev) => ({ ...prev, paymentMethod: e.target.value }))
                        }
                        className="w-full pl-3 pr-10 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white appearance-none"
                      >
                        <option value="BANK_TRANSFER">Transfer Bank</option>
                        <option value="CASH">Tunai (Cash)</option>
                        <option value="OTHER">Lainnya</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      No. Referensi / Transfer
                    </label>
                    <input
                      type="text"
                      value={statusSlipModal.paymentReference}
                      onChange={(e) =>
                        setStatusSlipModal((prev) => ({
                          ...prev,
                          paymentReference: e.target.value,
                        }))
                      }
                      placeholder="Contoh: TRF-BCA-88291"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setStatusSlipModal((prev) => ({ ...prev, open: false }))}
                className="px-4 py-2 text-sm font-medium text-slate-600"
              >
                Batal
              </button>
              <button
                onClick={handleUpdateSlipStatus}
                disabled={statusSlipModal.submitting}
                className={`px-5 py-2 text-white text-sm font-semibold rounded-xl shadow-sm transition-all ${
                  statusSlipModal.targetStatus === 'PAID'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-blue-900 hover:bg-blue-800'
                }`}
              >
                {statusSlipModal.submitting
                  ? 'Menyimpan...'
                  : statusSlipModal.targetStatus === 'PAID'
                  ? 'Konfirmasi Pembayaran'
                  : 'Konfirmasi Final'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: DETAIL SLIP GAJI                              */}
      {/* ==================================================== */}
      {selectedSlipDetail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="flex flex-col flex-1 min-h-0 bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92dvh] sm:max-h-[90vh] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Slip Gaji Karyawan</h3>
                  <p className="text-xs text-slate-500">
                    Periode{' '}
                    {new Date(2026, selectedSlipDetail.periodMonth - 1, 1).toLocaleDateString(
                      'id-ID',
                      { month: 'long' }
                    )}{' '}
                    {selectedSlipDetail.periodYear}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSlipDetail(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-4 text-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-xs text-slate-500">Nama Karyawan:</span>
                  <p className="font-bold text-slate-800">{selectedSlipDetail.user?.name}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500">Status:</span>
                  <p className="font-semibold text-blue-900">{selectedSlipDetail.status}</p>
                </div>
              </div>

              {/* Rincian Penerimaan */}
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Penerimaan (Pendapatan)
                </span>
                <div className="mt-2 space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex justify-between text-slate-600">
                    <span>Gaji Pokok:</span>
                    <span className="font-medium text-slate-800">
                      {formatRupiah(selectedSlipDetail.baseSalary)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Upah Lembur (Overtime):</span>
                    <span className="font-medium text-emerald-700">
                      +{formatRupiah(selectedSlipDetail.overtimePay)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Komisi Laundry:</span>
                    <span className="font-medium text-blue-700">
                      +{formatRupiah(selectedSlipDetail.commissionPay)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Bonus & Tunjangan:</span>
                    <span className="font-medium text-indigo-700">
                      +{formatRupiah(selectedSlipDetail.bonusAmount)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Rincian Potongan */}
              <div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Potongan
                </span>
                <div className="mt-2 space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="flex justify-between text-slate-600">
                    <span>Potongan Kasbon:</span>
                    <span className="font-medium text-rose-700">
                      -{formatRupiah(selectedSlipDetail.cashAdvanceDeduction)}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Potongan Lainnya:</span>
                    <span className="font-medium text-rose-700">
                      -{formatRupiah(selectedSlipDetail.otherDeduction)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Total Bersih */}
              <div className="p-4 bg-blue-900 text-white rounded-2xl flex items-center justify-between">
                <span className="font-medium text-sm text-blue-100">Total Diterima (Net):</span>
                <span className="text-lg font-bold">
                  {formatRupiah(selectedSlipDetail.netSalary)}
                </span>
              </div>
            </div>

            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedSlipDetail(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl"
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
