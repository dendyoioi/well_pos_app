import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  Shirt,
  Truck,
  Package,
  Search,
  Settings,
  Download,
  Printer,
  X,
  CheckCircle2,
  Calendar,
  AlertCircle,
  FileText,
  UserCheck,
  Banknote,
  Plus,
  Trash2,
  HandCoins,
  Wallet,
  ChevronDown,
  TrendingUp,
  Clock,
} from 'lucide-react';
import type { User } from '../types/auth';
import type { Outlet } from '../types/outlet';
import type {
  LaundryCommissionConfig,
  LaundryStaffCommissionRow,
  LaundryCommissionReport,
  StaffCashAdvance,
} from '../types/laundry';
import { api } from '../services/api';
import { formatRupiah } from '../utils/currency';
import { TablePagination } from '../components/TablePagination';
import { TableSkeleton } from '../components/ui/TableSkeleton';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { StaffPerformanceEvaluationView } from '../components/laundry/StaffPerformanceEvaluationView';
import { WorkforceEnterprisePanel } from '../components/enterprise/WorkforceEnterprisePanel';

interface LaundryCommissionViewProps {
  activeOutlet: Outlet | null;
  currentUser: User;
}

const DEFAULT_CONFIG: LaundryCommissionConfig = {
  enabled: true,
  washingPerKg: 300,
  dryingPerKg: 200,
  ironingPerKg: 500,
  packingPerOrder: 500,
  deliveryPerTrip: 3000,
  pickupPerTrip: 2000,
  rewashPenaltyPerCase: 0,
  cashierCommissionEnabled: false,
  cashierCommissionBasis: 'PAID_ONLY',
  cashierCommissionTiers: [
    { minSales: 5000000, percent: 1.5 },
    { minSales: 10000000, percent: 3.0 },
  ],
};

type PeriodType = 'TODAY' | 'LAST_7' | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';

export const LaundryCommissionView: React.FC<LaundryCommissionViewProps> = ({
  activeOutlet,
  currentUser,
}) => {
  const isSupervisorOrAbove = ['OWNER', 'ADMIN', 'SUPERVISOR'].includes(currentUser.role);

  const [period, setPeriod] = useState<PeriodType>('THIS_MONTH');
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [search, setSearch] = useState('');

  const [report, setReport] = useState<LaundryCommissionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modal Atur Tarif Komisi
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configDraft, setConfigDraft] = useState<LaundryCommissionConfig>(DEFAULT_CONFIG);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configFeedback, setConfigFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal Slip Komisi Staf
  const [selectedStaffForSlip, setSelectedStaffForSlip] = useState<LaundryStaffCommissionRow | null>(null);
  const [showSlipModal, setShowSlipModal] = useState(false);

  // Modal Pencairan Kas Komisi (Pilar 3)
  const [selectedStaffForPayout, setSelectedStaffForPayout] = useState<LaundryStaffCommissionRow | null>(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [payoutNotes, setPayoutNotes] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [paidOutKeys, setPaidOutKeys] = useState<Record<string, boolean>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Tab Utama: Komisi Staf & Kurir vs Kasbon Karyawan vs Evaluasi Performa vs Lembur/Cuti/Payroll
  const [activeMainTab, setActiveMainTab] = useState<'COMMISSION' | 'CASH_ADVANCE' | 'PERFORMANCE' | 'WORKFORCE'>('COMMISSION');

  // Role Guard: Kembalikan tab ke COMMISSION jika user bukan Owner/Admin/Supervisor
  useEffect(() => {
    if (!isSupervisorOrAbove && activeMainTab === 'PERFORMANCE') {
      setActiveMainTab('COMMISSION');
    }
  }, [isSupervisorOrAbove, activeMainTab]);

  // State Kasbon Karyawan (P2)
  const [advances, setAdvances] = useState<StaffCashAdvance[]>([]);
  const [advanceSummary, setAdvanceSummary] = useState<{ totalActiveDebt: number; countPending: number } | null>(null);
  const [loadingAdvances, setLoadingAdvances] = useState(false);
  const [advanceStatusFilter, setAdvanceStatusFilter] = useState('ALL');
  const [advanceSearch, setAdvanceSearch] = useState('');
  const [advancePage, setAdvancePage] = useState(1);
  const [advancePageSize, setAdvancePageSize] = useState(10);

  // Modal Catat Kasbon Baru
  const [showCreateAdvanceModal, setShowCreateAdvanceModal] = useState(false);
  const [advanceStaffName, setAdvanceStaffName] = useState('');
  const [advanceStaffId, setAdvanceStaffId] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState(0);
  const [advanceReason, setAdvanceReason] = useState('');
  const [deductFromOpenShift, setDeductFromOpenShift] = useState(true);
  const [submittingAdvance, setSubmittingAdvance] = useState(false);

  // Modal Pelunasan Kasbon
  const [selectedAdvanceForRepay, setSelectedAdvanceForRepay] = useState<StaffCashAdvance | null>(null);
  const [repayAmount, setRepayAmount] = useState(0);
  const [repayNotes, setRepayNotes] = useState('');
  const [submittingRepay, setSubmittingRepay] = useState(false);

  // State auto-offset potongan kasbon saat pencairan komisi (P2)
  const [deductCashAdvance, setDeductCashAdvance] = useState(true);
  const [cashAdvanceDeductionAmount, setCashAdvanceDeductionAmount] = useState(0);

  const handleOpenPayoutModal = (staff: LaundryStaffCommissionRow) => {
    setSelectedStaffForPayout(staff);
    const advanceDebt = staff.outstandingCashAdvance || 0;
    if (advanceDebt > 0) {
      setDeductCashAdvance(true);
      setCashAdvanceDeductionAmount(Math.min(advanceDebt, staff.totalCommission));
    } else {
      setDeductCashAdvance(false);
      setCashAdvanceDeductionAmount(0);
    }
    setPayoutNotes('');
    setShowPayoutModal(true);
  };

  const fetchAdvances = async () => {
    try {
      setLoadingAdvances(true);
      const res = await api.getStaffCashAdvances({
        outletId: activeOutlet?.id,
        status: advanceStatusFilter !== 'ALL' ? advanceStatusFilter : undefined,
        search: advanceSearch.trim() || undefined,
      });
      if (res.status === 'success' && res.data) {
        setAdvances(res.data);
        if (res.summary) {
          setAdvanceSummary(res.summary);
        }
      }
    } catch (err) {
      console.error('Error fetching staff cash advances:', err);
    } finally {
      setLoadingAdvances(false);
    }
  };

  useEffect(() => {
    fetchAdvances();
  }, [activeOutlet?.id, advanceStatusFilter, advanceSearch]);

  const handleSubmitAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOutlet?.id) {
      alert('Toko / Outlet aktif tidak ditemukan');
      return;
    }
    if (!advanceStaffName.trim()) {
      alert('Nama karyawan wajib diisi.');
      return;
    }
    if (!advanceAmount || advanceAmount <= 0) {
      alert('Nominal kasbon harus lebih dari Rp 0.');
      return;
    }

    setSubmittingAdvance(true);
    try {
      const res = await api.createStaffCashAdvance({
        outletId: activeOutlet.id,
        staffId: advanceStaffId || undefined,
        staffName: advanceStaffName.trim(),
        amount: advanceAmount,
        reason: advanceReason.trim() || undefined,
        deductFromOpenShift,
      });

      if (res.status === 'success') {
        setShowCreateAdvanceModal(false);
        setAdvanceStaffName('');
        setAdvanceStaffId('');
        setAdvanceAmount(0);
        setAdvanceReason('');
        setToastMessage(`✅ ${res.message || 'Kasbon karyawan berhasil dicatat!'}`);
        setTimeout(() => setToastMessage(null), 4000);
        fetchAdvances();
        fetchCommissions();
      } else {
        alert(res.message || 'Gagal mencatat kasbon');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmittingAdvance(false);
    }
  };

  const handleSubmitRepay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAdvanceForRepay) return;
    if (!repayAmount || repayAmount <= 0) {
      alert('Nominal pelunasan harus lebih dari Rp 0.');
      return;
    }
    if (repayAmount > selectedAdvanceForRepay.remainingAmount) {
      alert(`Nominal melebihi sisa kasbon (maks. ${formatRupiah(selectedAdvanceForRepay.remainingAmount)}).`);
      return;
    }

    setSubmittingRepay(true);
    try {
      const res = await api.repayStaffCashAdvance(selectedAdvanceForRepay.id, {
        amount: repayAmount,
        notes: repayNotes.trim() || undefined,
      });

      if (res.status === 'success') {
        setSelectedAdvanceForRepay(null);
        setRepayAmount(0);
        setRepayNotes('');
        setToastMessage(`✅ ${res.message || 'Pelunasan kasbon berhasil dicatat!'}`);
        setTimeout(() => setToastMessage(null), 4000);
        fetchAdvances();
        fetchCommissions();
      } else {
        alert(res.message || 'Gagal memproses pelunasan');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmittingRepay(false);
    }
  };

  const filteredAdvances = useMemo(() => {
    if (!advanceSearch.trim()) return advances;
    const q = advanceSearch.toLowerCase();
    return advances.filter(
      (a) => a.staffName.toLowerCase().includes(q) || (a.reason || '').toLowerCase().includes(q)
    );
  }, [advances, advanceSearch]);

  const paginatedAdvances = useMemo(() => {
    const startIndex = (advancePage - 1) * advancePageSize;
    return filteredAdvances.slice(startIndex, startIndex + advancePageSize);
  }, [filteredAdvances, advancePage, advancePageSize]);

  // Sinkronisasi rentang tanggal berdasarkan period pill
  const handlePeriodChange = (newPeriod: PeriodType) => {
    setPeriod(newPeriod);
    const now = new Date();

    if (newPeriod === 'TODAY') {
      const today = now.toISOString().split('T')[0];
      setStartDate(today);
      setEndDate(today);
    } else if (newPeriod === 'LAST_7') {
      const past = new Date(now.getTime() - 6 * 24 * 3600 * 1000);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (newPeriod === 'THIS_MONTH') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      setStartDate(firstDay);
      setEndDate(now.toISOString().split('T')[0]);
    } else if (newPeriod === 'LAST_MONTH') {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      setStartDate(firstDayLastMonth);
      setEndDate(lastDayLastMonth);
    }
  };

  // Muat data komisi dari API
  const fetchCommissions = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await api.getLaundryCommissions({
        outletId: activeOutlet?.id,
        startDate,
        endDate,
        search: search.trim() || undefined,
      });

      if (res.status === 'success' && res.data) {
        setReport(res.data);
        if (res.data.config) {
          setConfigDraft(res.data.config);
        }
      } else {
        setError(res.message || 'Gagal memuat data komisi staf');
      }
    } catch (err: any) {
      console.error('Error fetching laundry commissions:', err);
      setError(err?.message || 'Terjadi kesalahan jaringan saat memuat data komisi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommissions();
  }, [activeOutlet?.id, startDate, endDate, search]);

  // Reset page saat filter pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [search, startDate, endDate, period]);

  // Simpan konfigurasi tarif komisi
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingConfig(true);
      setConfigFeedback(null);

      const res = await api.updateLaundryCommissionConfig({
        outletId: activeOutlet?.id,
        config: configDraft,
      });

      if (res.status === 'success') {
        setConfigFeedback({ type: 'success', message: 'Tarif komisi berhasil diperbarui' });
        setTimeout(() => {
          setShowConfigModal(false);
          setConfigFeedback(null);
          fetchCommissions();
        }, 800);
      } else {
        setConfigFeedback({ type: 'error', message: res.message || 'Gagal menyimpan tarif komisi' });
      }
    } catch (err: any) {
      setConfigFeedback({ type: 'error', message: err?.message || 'Gagal menyimpan konfigurasi' });
    } finally {
      setSavingConfig(false);
    }
  };

  // Ekspor rekap komisi ke CSV
  const handleExportCsv = () => {
    if (!report || !report.staff || report.staff.length === 0) {
      alert('Tidak ada data komisi untuk diekspor pada rentang tanggal ini.');
      return;
    }

    const headers = [
      'Nama Staf',
      'Peran Operasional',
      'Cuci (Kg)',
      'Komisi Cuci (Rp)',
      'Kering (Kg)',
      'Komisi Kering (Rp)',
      'Setrika (Kg)',
      'Komisi Setrika (Rp)',
      'Packing (Nota)',
      'Komisi Packing (Rp)',
      'Kurir (Trip)',
      'Komisi Kurir (Rp)',
      'Penalti Rewash (Rp)',
      'Total Komisi Bersih (Rp)',
    ];

    const rows = report.staff.map((s) => [
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.roleType === 'BOTH' ? 'Operator & Kurir' : s.roleType === 'COURIER' ? 'Kurir Delivery' : 'Operator Produksi'}"`,
      s.washingKg,
      s.washingCommission,
      s.dryingKg,
      s.dryingCommission,
      s.ironingKg,
      s.ironingCommission,
      s.packingOrders,
      s.packingCommission,
      s.deliveryTrips + s.pickupTrips,
      s.deliveryCommission,
      s.rewashPenalty,
      s.totalCommission,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `rekap-komisi-${activeOutlet?.name || 'laundry'}-${startDate}_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pagination slice data staf
  const paginatedStaff = useMemo(() => {
    if (!report?.staff) return [];
    const startIndex = (currentPage - 1) * pageSize;
    return report.staff.slice(startIndex, startIndex + pageSize);
  }, [report?.staff, currentPage, pageSize]);

  return (
    <div className="space-y-6 pb-28 sm:pb-16 font-sans">
      {/* 1. Header View */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Komisi Staf Produksi &amp; Kurir
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-100 text-blue-900">
              Laundry
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Rekap insentif otomatis berdasarkan tonase cuci/setrika, packing, dan trip pengantaran
          </p>
        </div>

        {/* Action Buttons Top Bar */}
        <div className="flex items-center flex-wrap gap-2 w-full lg:w-auto shrink-0">
          {isSupervisorOrAbove && (
            <button
              type="button"
              onClick={() => setShowConfigModal(true)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Settings className="w-4 h-4 text-slate-600" />
              <span>Atur Tarif Komisi</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={loading || !report?.staff?.length}
            className="px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-800 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            disabled={loading || !report?.staff?.length}
            className="px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Rekap</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Komisi Staf & Kurir vs Kasbon Karyawan) */}
      <div className="flex items-center gap-2 border-b border-slate-200 no-print overflow-x-auto scrollbar-none flex-nowrap">
        <button
          type="button"
          onClick={() => setActiveMainTab('COMMISSION')}
          className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2 ${
            activeMainTab === 'COMMISSION'
              ? 'border-blue-900 text-blue-900 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award className="w-4 h-4 stroke-[2.5]" />
          <span>Komisi Staf &amp; Kurir</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab('CASH_ADVANCE')}
          className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2 ${
            activeMainTab === 'CASH_ADVANCE'
              ? 'border-blue-900 text-blue-900 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <HandCoins className="w-4 h-4 stroke-[2.5]" />
          <span>Kasbon Karyawan</span>
          {advanceSummary && advanceSummary.countPending > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-mono font-bold">
              {advanceSummary.countPending}
            </span>
          )}
        </button>

        {isSupervisorOrAbove && (
          <button
            type="button"
            onClick={() => setActiveMainTab('PERFORMANCE')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2 ${
              activeMainTab === 'PERFORMANCE'
                ? 'border-blue-900 text-blue-900 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <TrendingUp className="w-4 h-4 stroke-[2.5]" />
            <span>Evaluasi Performa Staf</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setActiveMainTab('WORKFORCE')}
          className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2 ${
            activeMainTab === 'WORKFORCE'
              ? 'border-blue-900 text-blue-900 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4 stroke-[2.5]" />
          <span>Lembur, Cuti &amp; Payroll</span>
        </button>
      </div>

      {activeMainTab === 'COMMISSION' ? (
        <>
          {/* 2. Filter Bar: Pill Periode & Custom Date + Search */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Periode Pills */}
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>Periode:</span>
            </span>
            <button
              type="button"
              onClick={() => handlePeriodChange('TODAY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === 'TODAY'
                  ? 'bg-blue-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Hari Ini
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange('LAST_7')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === 'LAST_7'
                  ? 'bg-blue-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              7 Hari
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange('THIS_MONTH')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === 'THIS_MONTH'
                  ? 'bg-blue-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Bulan Ini
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange('LAST_MONTH')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === 'LAST_MONTH'
                  ? 'bg-blue-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              Bulan Lalu
            </button>
          </div>

          {/* Date Picker Custom & Search Input */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPeriod('CUSTOM');
                }}
                className="h-9 px-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-900/20"
              />
              <span className="text-slate-400 font-bold">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPeriod('CUSTOM');
                }}
                className="h-9 px-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-900/20"
              />
            </div>

            <div className="relative min-w-[200px] sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Cari nama staf..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-9 pl-10 pr-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 text-xs font-medium placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-900/20"
              />
            </div>
          </div>
        </div>

        {/* Warning jika komisi nonaktif */}
        {report && report.config && !report.config.enabled && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-800">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>
              Perhitungan komisi saat ini berstatus <strong>Nonaktif</strong>. Klik tombol <strong>Atur Tarif Komisi</strong> untuk mengaktifkan kembali insentif otomatis.
            </span>
          </div>
        )}
      </div>

      {/* 3. Empat Kartu KPI Ringkas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Komisi Bersih */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Total Komisi Bersih
            </span>
            <div className="text-xl sm:text-2xl font-black text-blue-950 mt-1">
              {formatRupiah(report?.summary?.grandTotalCommission || 0)}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block font-medium">
              {report?.summary?.totalStaff || 0} Staf berhak menerima insentif
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-900 flex items-center justify-center shrink-0">
            <Award className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 2: Komisi Produksi */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Komisi Produksi
            </span>
            <div className="text-xl sm:text-2xl font-black text-amber-700 mt-1">
              {formatRupiah(report?.summary?.totalProductionCommission || 0)}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block font-medium">
              Cuci, Kering, Setrika &amp; Packing
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <Shirt className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 3: Komisi Kurir Delivery */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Komisi Kurir Delivery
            </span>
            <div className="text-xl sm:text-2xl font-black text-indigo-700 mt-1">
              {formatRupiah(report?.summary?.totalDeliveryCommission || 0)}
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block font-medium">
              Trip jemput &amp; antar pelanggan
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
            <Truck className="w-6 h-6" />
          </div>
        </div>

        {/* KPI 4: Total Volume Kerja */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
              Total Volume Kerja
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
              {report?.summary?.totalKgProcessed || 0} Kg
            </div>
            <span className="text-[11px] text-slate-400 mt-0.5 block font-medium">
              {report?.summary?.totalTripsCompleted || 0} Trip Kurir terselesaikan
            </span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <Package className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 4. Tabel Desktop & List Responsif Mobile */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Rincian Komisi Per Staf / Operator</h3>
            <p className="text-xs text-slate-500">
              Menampilkan {paginatedStaff.length} dari {report?.staff?.length || 0} staf
            </p>
          </div>
        </div>

        {error ? (
          <div className="p-8 text-center text-rose-600 text-xs font-medium">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 text-rose-500" />
            <p>{error}</p>
          </div>
        ) : (
          <>
            {/* Desktop View Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Nama Staf &amp; Peran</th>
                    <th className="py-3 px-4 text-right">Cuci (Kg)</th>
                    <th className="py-3 px-4 text-right">Kering (Kg)</th>
                    <th className="py-3 px-4 text-right">Setrika (Kg)</th>
                    <th className="py-3 px-4 text-right">Packing (Nota)</th>
                    <th className="py-3 px-4 text-right">Kurir (Trip)</th>
                    <th className="py-3 px-4 text-right">Penalti Rewash</th>
                    <th className="py-3 px-4 text-right">Total Komisi</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <TableSkeleton rows={5} columns={8} actionCol />
                  ) : paginatedStaff.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <UserCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm font-bold text-slate-700">Belum Ada Catatan Kerja</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Belum ada aktivitas cuci/setrika atau trip pengantaran yang diselesaikan pada periode ini.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedStaff.map((s, idx) => {
                      const payoutKey = `${s.name.toLowerCase()}_${startDate}_${endDate}`;
                      const isPaidOut = Boolean(paidOutKeys[payoutKey]);
                      return (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {s.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block">{s.name}</span>
                              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                    s.roleType === 'BOTH'
                                      ? 'bg-purple-100 text-purple-800'
                                      : s.roleType === 'COURIER'
                                      ? 'bg-indigo-100 text-indigo-800'
                                      : s.roleType === 'CASHIER'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {s.roleType === 'BOTH'
                                    ? 'Operator & Kurir'
                                    : s.roleType === 'COURIER'
                                    ? 'Kurir Delivery'
                                    : s.roleType === 'CASHIER'
                                    ? 'Kasir Penjualan'
                                    : 'Operator Produksi'}
                                </span>
                                {(s.outstandingCashAdvance || 0) > 0 && (
                                  <span className="inline-block px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                    Kasbon: {formatRupiah(s.outstandingCashAdvance || 0)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <span className="font-bold text-slate-800 block">
                            {s.washingKg > 0 ? `${s.washingKg} Kg` : '-'}
                          </span>
                          {s.washingCommission > 0 && (
                            <span className="text-[10px] text-slate-500">
                              {formatRupiah(s.washingCommission)}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <span className="font-bold text-slate-800 block">
                            {s.dryingKg > 0 ? `${s.dryingKg} Kg` : '-'}
                          </span>
                          {s.dryingCommission > 0 && (
                            <span className="text-[10px] text-slate-500">
                              {formatRupiah(s.dryingCommission)}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <span className="font-bold text-slate-800 block">
                            {s.ironingKg > 0 ? `${s.ironingKg} Kg` : '-'}
                          </span>
                          {s.ironingCommission > 0 && (
                            <span className="text-[10px] text-amber-700 font-semibold">
                              {formatRupiah(s.ironingCommission)}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <span className="font-bold text-slate-800 block">
                            {s.packingOrders > 0 ? `${s.packingOrders} Nota` : '-'}
                          </span>
                          {s.packingCommission > 0 && (
                            <span className="text-[10px] text-slate-500">
                              {formatRupiah(s.packingCommission)}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <span className="font-bold text-slate-800 block">
                            {s.deliveryTrips + s.pickupTrips > 0
                              ? `${s.deliveryTrips + s.pickupTrips} Trip`
                              : '-'}
                          </span>
                          {s.deliveryCommission > 0 && (
                            <span className="text-[10px] text-indigo-700 font-semibold">
                              {formatRupiah(s.deliveryCommission)}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          {s.rewashPenalty > 0 ? (
                            <div>
                              <span className="font-bold text-rose-700">-{formatRupiah(s.rewashPenalty)}</span>
                              <span className="text-[10px] text-rose-500 block">
                                ({s.rewashCount} Kasus)
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <span className="font-black text-blue-950 text-sm">
                            {formatRupiah(s.totalCommission)}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {isSupervisorOrAbove && s.totalCommission > 0 && (
                              isPaidOut ? (
                                <span className="px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold inline-flex items-center gap-1">
                                  ✓ Tercatat
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenPayoutModal(s)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                                  title="Catat Pencairan Kas Komisi"
                                >
                                  <Banknote className="w-3.5 h-3.5" />
                                  <span>Cairkan Kas</span>
                                </button>
                              )
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedStaffForSlip(s);
                                setShowSlipModal(true);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5 text-slate-500" />
                              <span>Slip</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile / Tablet Responsive Card List */}
            <div className="lg:hidden divide-y divide-slate-100">
              {loading ? (
                <div className="p-4 space-y-3">
                  <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                  <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                  <div className="h-16 bg-slate-100 rounded-xl animate-pulse" />
                </div>
              ) : paginatedStaff.length === 0 ? (
                <div className="py-12 px-4 text-center text-slate-400">
                  <UserCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-sm font-bold text-slate-700">Belum Ada Catatan Kerja</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Belum ada aktivitas komisi yang tercatat pada rentang tanggal ini.
                  </p>
                </div>
              ) : (
                paginatedStaff.map((s, idx) => {
                  const payoutKey = `${s.name.toLowerCase()}_${startDate}_${endDate}`;
                  const isPaidOut = Boolean(paidOutKeys[payoutKey]);
                  return (
                  <div key={idx} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {s.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 text-xs block">{s.name}</span>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                s.roleType === 'BOTH'
                                  ? 'bg-purple-100 text-purple-800'
                                  : s.roleType === 'COURIER'
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : s.roleType === 'CASHIER'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {s.roleType === 'BOTH'
                                ? 'Operator & Kurir'
                                : s.roleType === 'COURIER'
                                ? 'Kurir Delivery'
                                : s.roleType === 'CASHIER'
                                ? 'Kasir Penjualan'
                                : 'Operator Produksi'}
                            </span>
                            {(s.outstandingCashAdvance || 0) > 0 && (
                              <span className="inline-block px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                Kasbon: {formatRupiah(s.outstandingCashAdvance || 0)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[11px] text-slate-400 font-medium block">Total Komisi</span>
                        <span className="font-black text-blue-950 text-sm">
                          {formatRupiah(s.totalCommission)}
                        </span>
                      </div>
                    </div>

                    {/* Breakdown Badges */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200/60">
                      <div>
                        <span className="text-slate-400 block">Cuci ({s.washingKg} Kg):</span>
                        <span className="font-bold text-slate-700">{formatRupiah(s.washingCommission)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Kering ({s.dryingKg} Kg):</span>
                        <span className="font-bold text-slate-700">{formatRupiah(s.dryingCommission)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Setrika ({s.ironingKg} Kg):</span>
                        <span className="font-bold text-amber-700">{formatRupiah(s.ironingCommission)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Packing ({s.packingOrders} Nota):</span>
                        <span className="font-bold text-slate-700">{formatRupiah(s.packingCommission)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Kurir ({s.deliveryTrips + s.pickupTrips} Trip):</span>
                        <span className="font-bold text-indigo-700">{formatRupiah(s.deliveryCommission)}</span>
                      </div>
                      {s.cashierCommission != null && s.cashierCommission > 0 && (
                        <div>
                          <span className="text-emerald-700 block">Kasir ({s.appliedTierPercent}%):</span>
                          <span className="font-bold text-emerald-800">{formatRupiah(s.cashierCommission)}</span>
                        </div>
                      )}
                      {s.rewashPenalty > 0 && (
                        <div>
                          <span className="text-rose-400 block">Penalti Rewash:</span>
                          <span className="font-bold text-rose-700">-{formatRupiah(s.rewashPenalty)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {isSupervisorOrAbove && s.totalCommission > 0 && (
                        isPaidOut ? (
                          <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold inline-flex items-center gap-1">
                            ✓ Tercatat
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenPayoutModal(s)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            <span>Catat Cairkan Kas</span>
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStaffForSlip(s);
                          setShowSlipModal(true);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-500" />
                        <span>Cetak Slip Komisi</span>
                      </button>
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {report?.staff && report.staff.length > 0 && (
              <div className="border-t border-slate-100 p-3 sm:p-4">
                <TablePagination
                  currentPage={currentPage}
                  pageSize={pageSize}
                  totalItems={report.staff.length}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={setPageSize}
                  itemLabel="staf"
                />
              </div>
            )}
          </>
        )}
      </div>
      </>
      ) : activeMainTab === 'CASH_ADVANCE' ? (
        <div className="space-y-6">
          {/* Summary KPI Cards Kasbon Karyawan */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Total Kasbon Aktif
                </span>
                <div className="text-xl sm:text-2xl font-black text-rose-700 mt-1 font-mono">
                  {formatRupiah(advanceSummary?.totalActiveDebt || 0)}
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 block font-medium">
                  {advanceSummary?.countPending || 0} pinjaman belum lunas
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-700 flex items-center justify-center shrink-0">
                <HandCoins className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Auto-Potong Komisi
                </span>
                <div className="text-sm font-bold text-emerald-800 mt-1">
                  Didukung Otomatis
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 block font-medium">
                  Kasbon dapat dipotong saat kasir mencairkan komisi
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                  Toko / Outlet Aktif
                </span>
                <div className="text-base font-black text-slate-900 mt-1 truncate">
                  {activeOutlet?.name || 'Toko Aktif'}
                </div>
                <span className="text-[11px] text-slate-400 mt-0.5 block font-medium">
                  Buku kasbon staf outlet
                </span>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-900 flex items-center justify-center shrink-0">
                <Wallet className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Toolbar Kasbon */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full sm:max-w-xl">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari nama karyawan, alasan..."
                  value={advanceSearch}
                  onChange={(e) => {
                    setAdvanceSearch(e.target.value);
                    setAdvancePage(1);
                  }}
                  className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-900 shadow-xs"
                />
              </div>

              {/* Status Filter */}
              <div className="relative w-full sm:w-44 shrink-0">
                <select
                  value={advanceStatusFilter}
                  onChange={(e) => {
                    setAdvanceStatusFilter(e.target.value);
                    setAdvancePage(1);
                  }}
                  className="w-full h-10 pl-3.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none appearance-none cursor-pointer focus:border-blue-900 shadow-xs"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="ACTIVE">Aktif (Belum Lunas)</option>
                  <option value="PAID">Lunas</option>
                  <option value="CANCELLED">Dibatalkan</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {isSupervisorOrAbove && (
              <button
                type="button"
                onClick={() => setShowCreateAdvanceModal(true)}
                className="h-10 px-4 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Catat Kasbon Baru</span>
              </button>
            )}
          </div>

          {/* Table Kasbon Karyawan */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Tanggal Pengajuan</th>
                    <th className="py-3 px-4">Nama Karyawan</th>
                    <th className="py-3 px-4 text-right">Nominal Kasbon</th>
                    <th className="py-3 px-4 text-right">Sisa Kasbon</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Alasan / Catatan</th>
                    <th className="py-3 px-4">Sumber Kas</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingAdvances ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        Memuat data kasbon karyawan...
                      </td>
                    </tr>
                  ) : paginatedAdvances.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <HandCoins className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm font-bold text-slate-700">Belum Ada Kasbon Karyawan</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Pinjaman atau kasbon staf akan tercatat di sini dan dapat dipotong otomatis dari komisi bulanan.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    paginatedAdvances.map((adv) => {
                      const isActive = adv.status === 'OPEN' || adv.status === 'PARTIAL';
                      return (
                        <tr key={adv.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="font-bold text-slate-800 block">
                              {new Date(adv.createdAt).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(adv.createdAt).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 whitespace-nowrap">
                            {adv.staffName}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-700 whitespace-nowrap">
                            {formatRupiah(adv.amount)}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <span className="font-black font-mono text-sm text-rose-700">
                              {formatRupiah(adv.remainingAmount)}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {isActive ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Aktif
                              </span>
                            ) : adv.status === 'PAID' ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                Lunas
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                                Batal
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                            {adv.reason || '-'}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {adv.shiftId ? (
                              <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 font-bold text-[10px]">
                                Laci Kasir Shift
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center whitespace-nowrap">
                            {isActive && isSupervisorOrAbove ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedAdvanceForRepay(adv);
                                  setRepayAmount(adv.remainingAmount);
                                  setRepayNotes('');
                                }}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-900 text-blue-900 hover:text-white rounded-lg text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1"
                              >
                                <Banknote className="w-3.5 h-3.5" />
                                <span>Pelunasan / Cicil</span>
                              </button>
                            ) : (
                              <span className="text-slate-400 text-xs">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List Kasbon */}
            <div className="lg:hidden divide-y divide-slate-100">
              {loadingAdvances ? (
                <div className="p-8 text-center text-slate-400 text-xs">Memuat kasbon...</div>
              ) : paginatedAdvances.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <HandCoins className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-slate-600 text-xs">Belum ada kasbon</p>
                </div>
              ) : (
                paginatedAdvances.map((adv) => {
                  const isActive = adv.status === 'OPEN' || adv.status === 'PARTIAL';
                  return (
                    <div key={adv.id} className="p-4 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-slate-900 text-xs block">{adv.staffName}</span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(adv.createdAt).toLocaleDateString('id-ID')}
                          </span>
                        </div>
                        {isActive ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Aktif
                          </span>
                        ) : adv.status === 'PAID' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Lunas
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                            Batal
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Pinjaman Awal</span>
                          <span className="font-mono font-semibold text-slate-700">{formatRupiah(adv.amount)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Sisa Kasbon</span>
                          <span className="font-mono font-black text-rose-700">{formatRupiah(adv.remainingAmount)}</span>
                        </div>
                      </div>

                      {adv.reason && (
                        <p className="text-[11px] text-slate-500 italic">{adv.reason}</p>
                      )}

                      {isActive && isSupervisorOrAbove && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAdvanceForRepay(adv);
                            setRepayAmount(adv.remainingAmount);
                            setRepayNotes('');
                          }}
                          className="w-full py-2 bg-blue-50 text-blue-900 rounded-xl text-xs font-bold hover:bg-blue-900 hover:text-white transition-all flex items-center justify-center gap-1.5"
                        >
                          <Banknote className="w-3.5 h-3.5" />
                          <span>Pelunasan / Cicil Kasbon</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Kasbon */}
            {filteredAdvances.length > 0 && (
              <div className="border-t border-slate-100 p-3 sm:p-4">
                <TablePagination
                  currentPage={advancePage}
                  pageSize={advancePageSize}
                  totalItems={filteredAdvances.length}
                  onPageChange={setAdvancePage}
                  onPageSizeChange={setAdvancePageSize}
                  itemLabel="kasbon"
                />
              </div>
            )}
          </div>
        </div>
      ) : activeMainTab === 'PERFORMANCE' && isSupervisorOrAbove ? (
        <StaffPerformanceEvaluationView
          activeOutletId={activeOutlet?.id || ''}
          currentUser={currentUser}
        />
      ) : activeMainTab === 'WORKFORCE' ? (
        <WorkforceEnterprisePanel
          activeOutlet={activeOutlet}
          currentUser={currentUser}
        />
      ) : null}

      {/* Modal Catat Kasbon Baru */}
      {showCreateAdvanceModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92dvh] sm:max-h-[90vh] shadow-2xl flex flex-col min-h-0 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold">
                  <HandCoins className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                    Catat Kasbon Karyawan
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">Pinjaman dana staf laundry</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateAdvanceModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAdvance} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain flex-1 space-y-4 text-xs">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nama Karyawan / Staf <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Budi Santoso"
                    value={advanceStaffName}
                    onChange={(e) => setAdvanceStaffName(e.target.value)}
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nominal Kasbon (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <CurrencyInput
                    value={advanceAmount}
                    onChange={setAdvanceAmount}
                    placeholder="0"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black font-mono text-blue-900 focus:outline-none focus:border-blue-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Alasan Pinjaman / Keterangan
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Keperluan mendesak keluarga..."
                    value={advanceReason}
                    onChange={(e) => setAdvanceReason(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-900 resize-none"
                  />
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-blue-950">
                    <input
                      type="checkbox"
                      checked={deductFromOpenShift}
                      onChange={(e) => setDeductFromOpenShift(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-900 focus:ring-blue-900 cursor-pointer"
                    />
                    <span>Keluarkan Uang dari Laci Kasir Shift Aktif</span>
                  </label>
                  <p className="text-[11px] text-blue-800 pl-6">
                    Jika dicentang, pengeluaran kasbon akan otomatis memotong saldo uang kas fisik laci kasir saat ini.
                  </p>
                </div>
              </div>

              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateAdvanceModal(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingAdvance || !advanceAmount || advanceAmount <= 0}
                  className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-900/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submittingAdvance ? 'Menyimpan...' : 'Simpan Kasbon'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Pelunasan Kasbon */}
      {selectedAdvanceForRepay && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92dvh] sm:max-h-[90vh] shadow-2xl flex flex-col min-h-0 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                    Pelunasan / Cicilan Kasbon
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {selectedAdvanceForRepay.staffName} • Sisa {formatRupiah(selectedAdvanceForRepay.remainingAmount)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAdvanceForRepay(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitRepay} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 overflow-y-auto overscroll-contain flex-1 space-y-4 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Pinjaman Awal:</span>
                    <span className="font-bold text-slate-800">{formatRupiah(selectedAdvanceForRepay.amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sisa Kasbon Saat Ini:</span>
                    <span className="font-black text-rose-700 font-mono">
                      {formatRupiah(selectedAdvanceForRepay.remainingAmount)}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nominal Bayar / Cicil (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <CurrencyInput
                    value={repayAmount}
                    onChange={(val) => setRepayAmount(Math.min(val, selectedAdvanceForRepay.remainingAmount))}
                    placeholder="0"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black font-mono text-emerald-800 focus:outline-none focus:border-emerald-700"
                  />
                  <div className="flex items-center justify-between mt-1 text-[11px]">
                    <span className="text-slate-400">Maks. {formatRupiah(selectedAdvanceForRepay.remainingAmount)}</span>
                    <button
                      type="button"
                      onClick={() => setRepayAmount(selectedAdvanceForRepay.remainingAmount)}
                      className="font-bold text-blue-900 hover:underline cursor-pointer"
                    >
                      Lunasi Seluruhnya
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Catatan Pembayaran (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Bayar tunai di kasir / transfer BCA"
                    value={repayNotes}
                    onChange={(e) => setRepayNotes(e.target.value)}
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-900"
                  />
                </div>
              </div>

              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedAdvanceForRepay(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 font-bold text-xs text-slate-600 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingRepay || !repayAmount || repayAmount <= 0}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submittingRepay ? 'Memproses...' : 'Konfirmasi Pelunasan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 1: ATUR TARIF KOMISI OTOMATIS                  */}
      {/* ==================================================== */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-xl w-full max-h-[92dvh] sm:max-h-[90vh] shadow-2xl flex flex-col min-h-0 overflow-hidden">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-900" />
                <h3 className="font-black text-slate-900 text-sm">Pengaturan Tarif Komisi Staf &amp; Kurir</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveConfig} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 overflow-y-auto overscroll-contain flex-1 space-y-4 text-xs">
                {/* Feedback message */}
                {configFeedback && (
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                      configFeedback.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{configFeedback.message}</span>
                  </div>
                )}

                {/* Toggle Enable Commission */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="font-bold text-slate-800 block">Aktifkan Perhitungan Komisi</span>
                    <span className="text-[11px] text-slate-500">
                      Otomatis menghitung insentif berdasarkan rekaman timbang &amp; antrean
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={configDraft.enabled}
                    onChange={(e) => setConfigDraft({ ...configDraft, enabled: e.target.checked })}
                    className="w-5 h-5 rounded text-blue-900 focus:ring-blue-900 cursor-pointer"
                  />
                </div>

                {/* Sub-Header: Produksi */}
                <div className="pt-2">
                  <span className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Shirt className="w-4 h-4 text-amber-700" />
                    <span>Tarif Komisi Operator Produksi</span>
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Dihitung otomatis saat operator menyelesaikan tahapan pada modul Workshop
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Cuci / Kg (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={configDraft.washingPerKg}
                      onChange={(e) =>
                        setConfigDraft({ ...configDraft, washingPerKg: Number(e.target.value) || 0 })
                      }
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-900/20"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Kering / Kg (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={configDraft.dryingPerKg}
                      onChange={(e) =>
                        setConfigDraft({ ...configDraft, dryingPerKg: Number(e.target.value) || 0 })
                      }
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-900/20"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Setrika / Kg (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={configDraft.ironingPerKg}
                      onChange={(e) =>
                        setConfigDraft({ ...configDraft, ironingPerKg: Number(e.target.value) || 0 })
                      }
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-900/20"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Packing / Nota (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      step="50"
                      value={configDraft.packingPerOrder}
                      onChange={(e) =>
                        setConfigDraft({ ...configDraft, packingPerOrder: Number(e.target.value) || 0 })
                      }
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-900/20"
                    />
                  </div>
                </div>

                {/* Sub-Header: Kurir & Delivery */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-indigo-700" />
                    <span>Tarif Komisi Kurir Antar-Jemput</span>
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Dihitung otomatis per pesanan saat kurir menyelesaikan pengantaran ke pelanggan
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Antar / Delivery (per Trip)</label>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={configDraft.deliveryPerTrip}
                      onChange={(e) =>
                        setConfigDraft({ ...configDraft, deliveryPerTrip: Number(e.target.value) || 0 })
                      }
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-900/20"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Jemput / Pickup (per Trip)</label>
                    <input
                      type="number"
                      min="0"
                      step="500"
                      value={configDraft.pickupPerTrip}
                      onChange={(e) =>
                        setConfigDraft({ ...configDraft, pickupPerTrip: Number(e.target.value) || 0 })
                      }
                      className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-900/20"
                    />
                  </div>
                </div>

                {/* Sub-Header: Penalti Rewash */}
                <div className="pt-2 border-t border-slate-100">
                  <span className="font-black text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>Potongan Penalti Cuci Ulang (Opsional)</span>
                  </span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Potongan penalti jika terjadi komplain rewash akibat kelalaian (default: Rp 0)
                  </p>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Penalti per Kasus Rewash (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={configDraft.rewashPenaltyPerCase}
                    onChange={(e) =>
                      setConfigDraft({
                        ...configDraft,
                        rewashPenaltyPerCase: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-900/20"
                  />
                </div>

                {/* Sub-Header: Komisi Kasir Berjenjang (P2) */}
                <div className="pt-2 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-800 block flex items-center gap-1.5">
                        <Banknote className="w-4 h-4 text-emerald-600" />
                        <span>Komisi Penjualan Kasir (Berjenjang / Tiered)</span>
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Insentif persentase berjenjang dari akumulasi omset kasir
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(configDraft.cashierCommissionEnabled)}
                      onChange={(e) =>
                        setConfigDraft({
                          ...configDraft,
                          cashierCommissionEnabled: e.target.checked,
                          cashierCommissionBasis: configDraft.cashierCommissionBasis || 'PAID_ONLY',
                          cashierCommissionTiers: configDraft.cashierCommissionTiers || [
                            { minSales: 5000000, percent: 1.5 },
                            { minSales: 10000000, percent: 3.0 },
                          ],
                        })
                      }
                      className="w-5 h-5 rounded text-blue-900 focus:ring-blue-900 cursor-pointer"
                    />
                  </div>

                  {configDraft.cashierCommissionEnabled && (
                    <div className="p-3.5 rounded-2xl bg-slate-50/50 border border-slate-200 space-y-3">
                      <div>
                        <label className="font-bold text-slate-700 block mb-1">
                          Basis Perhitungan Omset Kasir
                        </label>
                        <div className="flex items-center gap-4 text-xs font-medium text-slate-700">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="cashierCommissionBasis"
                              value="PAID_ONLY"
                              checked={configDraft.cashierCommissionBasis !== 'ALL_ORDERS'}
                              onChange={() =>
                                setConfigDraft({ ...configDraft, cashierCommissionBasis: 'PAID_ONLY' })
                              }
                              className="text-blue-900 focus:ring-blue-900 cursor-pointer"
                            />
                            <span>Hanya Pesanan Lunas</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="radio"
                              name="cashierCommissionBasis"
                              value="ALL_ORDERS"
                              checked={configDraft.cashierCommissionBasis === 'ALL_ORDERS'}
                              onChange={() =>
                                setConfigDraft({ ...configDraft, cashierCommissionBasis: 'ALL_ORDERS' })
                              }
                              className="text-blue-900 focus:ring-blue-900 cursor-pointer"
                            />
                            <span>Seluruh Pesanan Non-Void</span>
                          </label>
                        </div>
                      </div>

                      {/* Tier Table */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="font-bold text-slate-700 text-xs">
                            Jenjang Omset &amp; Persentase Komisi
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const currentTiers = configDraft.cashierCommissionTiers || [];
                              setConfigDraft({
                                ...configDraft,
                                cashierCommissionTiers: [
                                  ...currentTiers,
                                  { minSales: 15000000, percent: 4.0 },
                                ],
                              });
                            }}
                            className="text-[11px] font-bold text-blue-900 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Tambah Jenjang</span>
                          </button>
                        </div>

                        <div className="space-y-2">
                          {(configDraft.cashierCommissionTiers || []).map((tier, idx) => (
                            <div key={idx} className="flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-200">
                              <span className="text-[11px] font-mono font-bold text-slate-400 w-5 text-center">
                                #{idx + 1}
                              </span>
                              <div className="flex-1">
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                                  Min. Omset (Rp)
                                </span>
                                <CurrencyInput
                                  value={tier.minSales}
                                  onChange={(val) => {
                                    const next = [...(configDraft.cashierCommissionTiers || [])];
                                    next[idx] = { ...next[idx], minSales: val };
                                    setConfigDraft({ ...configDraft, cashierCommissionTiers: next });
                                  }}
                                  className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none"
                                />
                              </div>
                              <div className="w-24">
                                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                                  Komisi (%)
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={tier.percent}
                                  onChange={(e) => {
                                    const next = [...(configDraft.cashierCommissionTiers || [])];
                                    next[idx] = { ...next[idx], percent: Number(e.target.value) || 0 };
                                    setConfigDraft({ ...configDraft, cashierCommissionTiers: next });
                                  }}
                                  className="w-full h-8 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:outline-none"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = (configDraft.cashierCommissionTiers || []).filter((_, i) => i !== idx);
                                  setConfigDraft({ ...configDraft, cashierCommissionTiers: next });
                                }}
                                className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer self-end mb-0.5"
                                title="Hapus jenjang tier"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-5 py-2 text-xs font-bold bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{savingConfig ? 'Menyimpan...' : 'Simpan Tarif Komisi'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: PRATINJAU & CETAK SLIP KOMISI STAF          */}
      {/* ==================================================== */}
      {showSlipModal && selectedStaffForSlip && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92dvh] sm:max-h-[90vh] shadow-2xl flex flex-col min-h-0 overflow-hidden">
            {/* Header Modal */}
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-900" />
                <h3 className="font-black text-slate-900 text-sm">Slip Komisi Staf Laundry</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSlipModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Slip Printable Content */}
            <div className="p-5 overflow-y-auto overscroll-contain flex-1 text-xs">
              <div className="border border-dashed border-slate-300 rounded-2xl p-4 bg-slate-50/50 space-y-3 font-mono">
                {/* Header Toko */}
                <div className="text-center pb-2 border-b border-slate-200">
                  <div className="font-black text-slate-900 text-sm uppercase">
                    {activeOutlet?.name || 'WELL POS LAUNDRY'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    SLIP INSENTIF &amp; KOMISI KERJA
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Periode: {startDate} s/d {endDate}
                  </div>
                </div>

                {/* Data Staf */}
                <div className="py-1 border-b border-slate-200 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nama Staf:</span>
                    <span className="font-bold text-slate-900">{selectedStaffForSlip.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Peran:</span>
                    <span className="font-semibold text-slate-800">
                      {selectedStaffForSlip.roleType === 'BOTH'
                        ? 'Operator & Kurir'
                        : selectedStaffForSlip.roleType === 'COURIER'
                        ? 'Kurir Delivery'
                        : 'Operator Produksi'}
                    </span>
                  </div>
                </div>

                {/* Rincian Komisi */}
                <div className="space-y-1.5 py-1 text-[11px]">
                  {selectedStaffForSlip.washingKg > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Cuci ({selectedStaffForSlip.washingKg} Kg):</span>
                      <span className="font-bold text-slate-900">
                        {formatRupiah(selectedStaffForSlip.washingCommission)}
                      </span>
                    </div>
                  )}

                  {selectedStaffForSlip.dryingKg > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Kering ({selectedStaffForSlip.dryingKg} Kg):</span>
                      <span className="font-bold text-slate-900">
                        {formatRupiah(selectedStaffForSlip.dryingCommission)}
                      </span>
                    </div>
                  )}

                  {selectedStaffForSlip.ironingKg > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Setrika ({selectedStaffForSlip.ironingKg} Kg):</span>
                      <span className="font-bold text-amber-800">
                        {formatRupiah(selectedStaffForSlip.ironingCommission)}
                      </span>
                    </div>
                  )}

                  {selectedStaffForSlip.packingOrders > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">Packing ({selectedStaffForSlip.packingOrders} Nota):</span>
                      <span className="font-bold text-slate-900">
                        {formatRupiah(selectedStaffForSlip.packingCommission)}
                      </span>
                    </div>
                  )}

                  {selectedStaffForSlip.deliveryTrips + selectedStaffForSlip.pickupTrips > 0 && (
                    <div className="flex justify-between">
                      <span className="text-slate-600">
                        Kurir ({selectedStaffForSlip.deliveryTrips + selectedStaffForSlip.pickupTrips} Trip):
                      </span>
                      <span className="font-bold text-indigo-800">
                        {formatRupiah(selectedStaffForSlip.deliveryCommission)}
                      </span>
                    </div>
                  )}

                  {selectedStaffForSlip.rewashPenalty > 0 && (
                    <div className="flex justify-between text-rose-700">
                      <span>Penalti Rewash ({selectedStaffForSlip.rewashCount} Kasus):</span>
                      <span className="font-bold">-{formatRupiah(selectedStaffForSlip.rewashPenalty)}</span>
                    </div>
                  )}
                </div>

                {/* Total Komisi Bersih */}
                <div className="pt-2 border-t-2 border-slate-900 flex justify-between items-center text-xs">
                  <span className="font-black text-slate-900 uppercase">Total Komisi:</span>
                  <span className="font-black text-base text-blue-950">
                    {formatRupiah(selectedStaffForSlip.totalCommission)}
                  </span>
                </div>

                <div className="text-[9px] text-center text-slate-400 pt-2">
                  Dicetak otomatis via Well POS • {new Date().toLocaleDateString('id-ID')}
                </div>
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-between">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 text-xs font-bold border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-slate-500" />
                <span>Cetak Slip</span>
              </button>

              <button
                type="button"
                onClick={() => setShowSlipModal(false)}
                className="px-5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 3: KONFIRMASI PENCAIRAN KAS KOMISI (Pilar 3)   */}
      {/* ==================================================== */}
      {showPayoutModal && selectedStaffForPayout && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full max-h-[92dvh] sm:max-h-[90vh] shadow-2xl flex flex-col min-h-0 overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
                    Catat Cairkan Kas Komisi
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {selectedStaffForPayout.name} • {activeOutlet?.name || 'Toko Aktif'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPayoutModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body Scrollable Modal */}
            <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 block">
                  Nominal Komisi Kotor
                </span>
                <div className="text-2xl font-black font-mono text-emerald-900">
                  {formatRupiah(selectedStaffForPayout.totalCommission)}
                </div>
                <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                  Pencairan komisi ini akan dicatat sebagai <strong>Kas Keluar (STAFF_COMMISSION)</strong> pada Laporan Arus Kas toko dan otomatis memotong saldo kas laci shift aktif (jika shift sedang dibuka).
                </p>
              </div>

              {/* Box Kasbon Karyawan Aktif (P2) */}
              {(selectedStaffForPayout.outstandingCashAdvance || 0) > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Kasbon Karyawan Aktif</span>
                    </span>
                    <span className="text-xs font-black font-mono text-amber-800">
                      {formatRupiah(selectedStaffForPayout.outstandingCashAdvance || 0)}
                    </span>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-amber-900">
                    <input
                      type="checkbox"
                      checked={deductCashAdvance}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setDeductCashAdvance(checked);
                        if (checked) {
                          setCashAdvanceDeductionAmount(
                            Math.min(selectedStaffForPayout.outstandingCashAdvance || 0, selectedStaffForPayout.totalCommission)
                          );
                        } else {
                          setCashAdvanceDeductionAmount(0);
                        }
                      }}
                      className="w-4 h-4 rounded text-blue-900 focus:ring-blue-900 cursor-pointer"
                    />
                    <span>Potong Kasbon Otomatis saat Pencairan</span>
                  </label>

                  {deductCashAdvance && (
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 mb-1">
                        Nominal Potongan Kasbon (Rp)
                      </label>
                      <CurrencyInput
                        value={cashAdvanceDeductionAmount}
                        onChange={(val) => {
                          const maxAllowed = Math.min(
                            selectedStaffForPayout.outstandingCashAdvance || 0,
                            selectedStaffForPayout.totalCommission
                          );
                          setCashAdvanceDeductionAmount(Math.min(val, maxAllowed));
                        }}
                        className="w-full h-10 px-3 bg-white border border-amber-300 rounded-xl text-xs font-mono font-bold text-amber-900 focus:outline-none"
                      />
                      <p className="text-[10px] text-amber-700 mt-1">
                        Maks. {formatRupiah(Math.min(selectedStaffForPayout.outstandingCashAdvance || 0, selectedStaffForPayout.totalCommission))}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Rincian Kas Keluar Bersih */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Komisi Kotor:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {formatRupiah(selectedStaffForPayout.totalCommission)}
                  </span>
                </div>
                {deductCashAdvance && cashAdvanceDeductionAmount > 0 && (
                  <div className="flex justify-between text-rose-600 font-medium">
                    <span>Potongan Kasbon:</span>
                    <span className="font-mono font-bold">
                      -{formatRupiah(cashAdvanceDeductionAmount)}
                    </span>
                  </div>
                )}
                <div className="pt-2 border-t border-slate-200 flex justify-between items-center text-slate-900">
                  <span className="font-black text-xs uppercase tracking-wider">
                    Sisa Kas Keluar (Kas Drawer):
                  </span>
                  <span className="text-base font-black font-mono text-blue-900">
                    {formatRupiah(
                      Math.max(0, selectedStaffForPayout.totalCommission - (deductCashAdvance ? cashAdvanceDeductionAmount : 0))
                    )}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Catatan Tambahan (Opsional)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Pencairan komisi via cash drawer kasir"
                  value={payoutNotes}
                  onChange={(e) => setPayoutNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-[13px] sm:text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-900"
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span>Penerima:</span>
                  <span className="font-bold text-slate-900">{selectedStaffForPayout.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Periode Kerja:</span>
                  <span className="font-bold text-slate-900">{startDate} s/d {endDate}</span>
                </div>
                <div className="flex justify-between">
                  <span>Kategori Arus Kas:</span>
                  <span className="font-mono font-bold text-blue-900">STAFF_COMMISSION</span>
                </div>
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div
              className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-end gap-2"
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
            >
              <button
                type="button"
                disabled={payoutLoading}
                onClick={() => setShowPayoutModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={payoutLoading}
                onClick={async () => {
                  if (!activeOutlet?.id) {
                    alert('Toko / Outlet aktif tidak ditemukan');
                    return;
                  }
                  setPayoutLoading(true);
                  try {
                    const res = await api.recordLaundryCommissionPayout({
                      outletId: activeOutlet.id,
                      staffName: selectedStaffForPayout.name,
                      staffId: selectedStaffForPayout.staffId,
                      amount: selectedStaffForPayout.totalCommission,
                      deductCashAdvanceAmount: deductCashAdvance ? cashAdvanceDeductionAmount : 0,
                      periodLabel: `${startDate} s/d ${endDate}`,
                      notes: payoutNotes.trim() || undefined,
                    });
                    if (res.status === 'success') {
                      if (selectedStaffForPayout) {
                        const payoutKey = `${selectedStaffForPayout.name.toLowerCase()}_${startDate}_${endDate}`;
                        setPaidOutKeys((prev) => ({ ...prev, [payoutKey]: true }));
                      }
                      setShowPayoutModal(false);
                      setToastMessage(`✅ ${res.message || 'Pencairan komisi berhasil dicatat ke Kas Keluar!'}`);
                      setTimeout(() => setToastMessage(null), 4000);
                      fetchCommissions();
                      fetchAdvances();
                    } else {
                      alert(`Gagal mencatat pencairan komisi: ${res.message}`);
                    }
                  } catch (err: any) {
                    alert(`Terjadi kesalahan: ${err?.message || 'Gagal menghubungi server'}`);
                  } finally {
                    setPayoutLoading(false);
                  }
                }}
                className="px-5 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-black transition-all shadow-md shadow-blue-900/20 cursor-pointer flex items-center gap-1.5"
              >
                {payoutLoading ? 'Menyimpan...' : 'Konfirmasi & Catat Kas Keluar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 p-4 rounded-2xl bg-blue-900 text-white text-xs font-bold shadow-xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
