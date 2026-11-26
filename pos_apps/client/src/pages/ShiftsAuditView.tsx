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
  UtensilsCrossed,
  FileText,
  Shirt,
  ChevronDown,
  Landmark,
  Plus,
  Check,
  XCircle,
  Shield,
} from 'lucide-react';
import { api } from '../services/api';
import type { Outlet } from '../types/outlet';
import { TablePagination } from '../components/TablePagination';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { computePresetDateRange } from '../utils/date';
import { checkIsLaundry } from '../utils/businessType';
import { GlobalAuditTrailPanel } from '../components/enterprise/GlobalAuditTrailPanel';

export const TARGET_ACCOUNTS_MAP: Record<string, string> = {
  KAS_BESAR: 'Kas Besar / Brankas Pusat',
  BANK_BCA: 'Transfer Bank BCA',
  BANK_MANDIRI: 'Transfer Bank Mandiri',
  BANK_BRI: 'Transfer Bank BRI',
  BANK_BNI: 'Transfer Bank BNI',
  LAINNYA: 'Kas / Rekening Lainnya',
};

export interface ShiftsAuditViewProps {
  activeOutlet?: Outlet | null;
  currentUser?: any | null;
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

const getShiftCashierName = (s: any) =>
  s.cashierName || (typeof s.cashier === 'string' ? s.cashier : s.cashier?.name) || 'Kasir';
const getShiftOutletName = (s: any) =>
  s.outletName || (typeof s.outlet === 'string' ? s.outlet : s.outlet?.name) || '-';

export const ShiftsAuditView: React.FC<ShiftsAuditViewProps> = ({ activeOutlet, currentUser }) => {
  const isLaundryMode = React.useMemo(() => {
    return checkIsLaundry(activeOutlet, currentUser);
  }, [activeOutlet, currentUser]);

  const [shifts, setShifts] = useState<any[]>([]);
  const [summary, setSummary] = useState<ShiftDiscrepancySummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  const isCashierRole = currentUser?.role === 'CASHIER';
  const [selectedCashier, setSelectedCashier] = useState<string>(() => {
    return currentUser?.role === 'CASHIER' && currentUser?.name ? currentUser.name : 'ALL';
  });
  const [selectedShift, setSelectedShift] = useState<any | null>(null);

  // Daftar nama kasir unik dari riwayat shift untuk filter
  const cashierOptions = React.useMemo(() => {
    const set = new Set<string>();
    shifts.forEach((s) => {
      const name = getShiftCashierName(s);
      if (name && name !== 'Kasir') set.add(name);
    });
    if (isCashierRole && currentUser?.name) {
      set.add(currentUser.name.trim());
    }
    return Array.from(set).sort();
  }, [shifts, isCashierRole, currentUser?.name]);

  // Period Preset Filter
  const [periodPreset, setPeriodPreset] = useState<'today' | '7days' | '30days' | 'thisMonth' | 'custom'>('thisMonth');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Pagination State (Standar Kanonikal 10/25/50/100)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Tab View State: Rekap Shift vs Setoran Kas vs Global Audit Trail
  const [activeTab, setActiveTab] = useState<'REKAP_SHIFT' | 'SETORAN_KAS' | 'AUDIT_TRAIL'>('REKAP_SHIFT');
  const isManager = ['OWNER', 'ADMIN', 'SUPERVISOR'].includes(currentUser?.role || '');

  // Setoran Kas State
  const [deposits, setDeposits] = useState<any[]>([]);
  const [depositSummary, setDepositSummary] = useState<{
    totalPendingAmount: number;
    pendingCount: number;
    totalVerifiedMonthAmount: number;
    verifiedCount: number;
  } | null>(null);
  const [loadingDeposits, setLoadingDeposits] = useState<boolean>(false);
  const [depositStatusFilter, setDepositStatusFilter] = useState<string>('ALL');
  const [depositSearch, setDepositSearch] = useState<string>('');
  const [depositCurrentPage, setDepositCurrentPage] = useState<number>(1);
  const [depositPageSize, setDepositPageSize] = useState<number>(10);
  const [totalDepositRecords, setTotalDepositRecords] = useState<number>(0);

  // Modal Ajukan Setoran Kas
  const [showCreateDepositModal, setShowCreateDepositModal] = useState<boolean>(false);
  const [selectedShiftForDeposit, setSelectedShiftForDeposit] = useState<string>('');
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [depositTargetAccount, setDepositTargetAccount] = useState<string>('KAS_BESAR');
  const [depositReference, setDepositReference] = useState<string>('');
  const [depositNotes, setDepositNotes] = useState<string>('');
  const [submittingDeposit, setSubmittingDeposit] = useState<boolean>(false);

  // Modal Penolakan Setoran
  const [rejectingDepositId, setRejectingDepositId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const canVerify = ['OWNER', 'SUPERADMIN', 'ADMIN', 'SUPERVISOR'].includes(currentUser?.role);

  const fetchDeposits = async () => {
    setLoadingDeposits(true);
    try {
      const outletIdParam = activeOutlet && !activeOutlet.isWarehouse ? activeOutlet.id : undefined;
      const res = await api.getShiftCashDeposits({
        outletId: outletIdParam,
        status: depositStatusFilter,
        page: depositCurrentPage,
        limit: depositPageSize,
      });
      if (res.status === 'success' && res.data) {
        setDeposits(res.data);
        if (res.summary) {
          setDepositSummary(res.summary);
        }
        if (res.pagination) {
          setTotalDepositRecords(res.pagination.totalRecords);
        }
      }
    } catch (err) {
      console.error('Error fetching shift cash deposits:', err);
    } finally {
      setLoadingDeposits(false);
    }
  };

  useEffect(() => {
    fetchDeposits();
  }, [depositStatusFilter, depositCurrentPage, depositPageSize, activeOutlet?.id]);

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShiftForDeposit) {
      alert('Pilih sesi shift kasir yang bersangkutan.');
      return;
    }
    if (!depositAmount || depositAmount <= 0) {
      alert('Nominal setoran kas harus lebih besar dari Rp 0.');
      return;
    }

    setSubmittingDeposit(true);
    try {
      const res = await api.createShiftCashDeposit({
        shiftId: selectedShiftForDeposit,
        amount: depositAmount,
        targetAccount: depositTargetAccount,
        referenceNumber: depositReference.trim() || undefined,
        notes: depositNotes.trim() || undefined,
      });

      if (res.status === 'success') {
        setShowCreateDepositModal(false);
        setDepositAmount(0);
        setDepositReference('');
        setDepositNotes('');
        fetchDeposits();
      } else {
        alert(res.message || 'Gagal mengajukan setoran kas');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat mengajukan setoran kas');
    } finally {
      setSubmittingDeposit(false);
    }
  };

  const handleVerifyDeposit = async (id: string) => {
    if (!window.confirm('Verifikasi dan terima setoran kas ini ke brankas/bank pusat?')) return;
    try {
      setVerifyingId(id);
      const res = await api.verifyShiftCashDeposit(id, { status: 'VERIFIED' });
      if (res.status === 'success') {
        fetchDeposits();
      } else {
        alert(res.message || 'Gagal memverifikasi setoran kas');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setVerifyingId(null);
    }
  };

  const handleRejectDeposit = async () => {
    if (!rejectingDepositId) return;
    if (!rejectionReason.trim()) {
      alert('Mohon masukkan alasan penolakan setoran kas.');
      return;
    }
    try {
      setVerifyingId(rejectingDepositId);
      const res = await api.verifyShiftCashDeposit(rejectingDepositId, {
        status: 'REJECTED',
        rejectionReason: rejectionReason.trim(),
      });
      if (res.status === 'success') {
        setRejectingDepositId(null);
        setRejectionReason('');
        fetchDeposits();
      } else {
        alert(res.message || 'Gagal menolak setoran kas');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setVerifyingId(null);
    }
  };

  const filteredDeposits = React.useMemo(() => {
    if (!depositSearch.trim()) return deposits;
    const q = depositSearch.toLowerCase();
    return deposits.filter((d) => {
      const cashier = (d.cashier?.name || '').toLowerCase();
      const outlet = (d.outlet?.name || '').toLowerCase();
      const ref = (d.referenceNumber || '').toLowerCase();
      const notes = (d.notes || '').toLowerCase();
      const target = (d.targetAccount || '').toLowerCase();
      return cashier.includes(q) || outlet.includes(q) || ref.includes(q) || notes.includes(q) || target.includes(q);
    });
  }, [deposits, depositSearch]);

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
        // Fallback jika mode standar atau role Kasir (403 Forbidden pada endpoint analitik laporan)
        const fallbackRes = await api.getShiftHistory(outletIdParam, { startDate, endDate });
        if (fallbackRes.status === 'success') {
          const list = fallbackRes.data || [];
          setShifts(list);

          // Client-side computed summary KPI fallback
          let matchCount = 0;
          let overCount = 0;
          let shortCount = 0;
          let totalOverAmount = 0;
          let totalShortAmount = 0;

          list.forEach((s: any) => {
            const diff =
              s.cashDifference != null
                ? Number(s.cashDifference)
                : (s.difference != null ? Number(s.difference) : 0);
            if (diff === 0) {
              matchCount++;
            } else if (diff > 0) {
              overCount++;
              totalOverAmount += diff;
            } else {
              shortCount++;
              totalShortAmount += Math.abs(diff);
            }
          });

          const totalAudited = list.length;
          const discrepancyCount = overCount + shortCount;
          const discrepancyRatePercent =
            totalAudited > 0 ? Number(((discrepancyCount / totalAudited) * 100).toFixed(1)) : 0;
          const netDifference = totalOverAmount - totalShortAmount;

          setSummary({
            totalShiftsAudited: totalAudited,
            matchCount,
            overCount,
            shortCount,
            totalOverAmount,
            totalShortAmount,
            netDifference,
            discrepancyRatePercent,
          });
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
        `"${getShiftCashierName(s)}"`,
        `"${getShiftOutletName(s)}"`,
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

  const filteredShifts = React.useMemo(() => {
    return shifts.filter((s) => {
      const cashier = getShiftCashierName(s);
      if (selectedCashier !== 'ALL' && cashier !== selectedCashier) {
        return false;
      }
      const q = search.toLowerCase();
      const outlet = getShiftOutletName(s).toLowerCase();
      const notes = (s.notes || '').toLowerCase();
      return cashier.toLowerCase().includes(q) || outlet.includes(q) || notes.includes(q);
    });
  }, [shifts, selectedCashier, search]);

  // Reset pagination ke halaman 1 saat pencarian atau filter kasir berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedCashier, periodPreset, customStart, customEnd, activeOutlet?.id]);

  const totalPages = Math.max(1, Math.ceil(filteredShifts.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedShifts = filteredShifts.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  return (
    <div className="space-y-6 pb-28 sm:pb-16 font-sans">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm no-print">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/20 shrink-0">
            <Clock className="w-6 h-6 stroke-[2.5] shrink-0" />
          </div>
          <div className="min-w-0 flex-1">
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

        <div className="flex items-center gap-2 self-start lg:self-auto w-full lg:w-auto shrink-0 justify-end">
          <button
            onClick={handleExportCSV}
            disabled={shifts.length === 0}
            className="w-full sm:w-auto h-10 px-4 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4 stroke-[2.5] shrink-0" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs (Rekap Shift Kasir vs Setoran Kas ke Pusat) */}
      <div className="flex items-center gap-2 border-b border-slate-200 no-print overflow-x-auto scrollbar-none flex-nowrap">
        <button
          onClick={() => setActiveTab('REKAP_SHIFT')}
          className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
            activeTab === 'REKAP_SHIFT'
              ? 'border-blue-900 text-blue-900 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4 stroke-[2.5] shrink-0" />
          <span>Rekap Shift Kasir</span>
        </button>
        <button
          onClick={() => setActiveTab('SETORAN_KAS')}
          className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
            activeTab === 'SETORAN_KAS'
              ? 'border-blue-900 text-blue-900 font-extrabold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Landmark className="w-4 h-4 stroke-[2.5] shrink-0" />
          <span>Setoran Kas ke Pusat</span>
          {depositSummary && depositSummary.pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-mono font-bold shrink-0">
              {depositSummary.pendingCount}
            </span>
          )}
        </button>

        {isManager && (
          <button
            onClick={() => setActiveTab('AUDIT_TRAIL')}
            className={`px-4 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'AUDIT_TRAIL'
                ? 'border-blue-900 text-blue-900 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-4 h-4 stroke-[2.5] shrink-0" />
            <span>Global Audit Trail</span>
          </button>
        )}
      </div>

      {activeTab === 'REKAP_SHIFT' ? (
        <>
          {/* Filter Controls Toolbar */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 no-print">
        {/* Preset Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full md:w-auto">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1 shrink-0">
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
              className={`h-10 px-3.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center justify-center ${
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full lg:w-auto">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="flex-1 sm:flex-initial min-w-0 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
              />
              <span className="text-xs text-slate-400 shrink-0">s/d</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="flex-1 sm:flex-initial min-w-0 h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
              />
            </div>
            <button
              onClick={fetchShifts}
              className="w-full sm:w-auto h-10 px-4 bg-blue-900 text-white rounded-xl text-xs font-bold hover:bg-blue-950 transition-all flex items-center justify-center cursor-pointer whitespace-nowrap shrink-0"
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
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                Shift Kasir Diaudit
              </span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold shrink-0">
                <Clock className="w-5 h-5 stroke-[2.5] shrink-0" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black font-mono text-slate-900 tracking-tight">
                {summary.totalShiftsAudited} Sesi
              </h3>
              <p className="text-[11px] text-slate-500 mt-1 font-medium">
                Rekapitulasi tutup kasir (Z-Report)
              </p>
            </div>
          </div>

          {/* Card 2: Shift Seimbang (Match) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                Kas Seimbang (Sesuai)
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                <CheckCircle2 className="w-5 h-5 stroke-[2.5] shrink-0" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black font-mono text-emerald-800 tracking-tight">
                {summary.matchCount} Shift
              </h3>
              <p className="text-[11px] text-emerald-700 mt-1 font-medium">
                <span className="font-mono">
                  {summary.totalShiftsAudited > 0
                    ? ((summary.matchCount / summary.totalShiftsAudited) * 100).toFixed(1)
                    : 100}%
                </span>{' '}
                akurasi uang laci fisik
              </p>
            </div>
          </div>

          {/* Card 3: Selisih Kurang (Shortage) */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                Selisih Kurang (Minus)
              </span>
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-800 flex items-center justify-center font-bold shrink-0">
                <TrendingDown className="w-5 h-5 stroke-[2.5] shrink-0" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-black font-mono text-rose-700 tracking-tight">
                -Rp {summary.totalShortAmount.toLocaleString('id-ID')}
              </h3>
              <p className="text-[11px] text-rose-600 mt-1 font-medium">
                Terjadi pada <span className="font-mono">{summary.shortCount}</span> sesi shift
              </p>
            </div>
          </div>

          {/* Card 4: Net Variance */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                Net Selisih Kasir
              </span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ${
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
              <h3 className={`text-2xl font-black font-mono tracking-tight ${
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:max-w-xl">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari kasir, outlet, atau catatan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-900 shadow-xs"
            />
          </div>

          {/* Filter Dropdown Nama Kasir */}
          <div className="relative w-full sm:w-auto shrink-0 h-10 flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-3 shadow-xs">
            <User className="w-4 h-4 text-blue-900 shrink-0" />
            <span className="text-xs font-bold text-slate-600 shrink-0">Kasir:</span>
            <select
              value={selectedCashier}
              onChange={(e) => {
                setSelectedCashier(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs font-bold text-slate-800 outline-none cursor-pointer pr-8 min-w-0 flex-1 sm:flex-initial truncate appearance-none"
              title="Filter Shift Berdasarkan Nama Kasir"
            >
              <option value="ALL">Semua Kasir di Toko Ini</option>
              {cashierOptions.map((c) => {
                const isMe = isCashierRole && currentUser?.name === c;
                return (
                  <option key={c} value={c}>
                    {c} {isMe ? '(Akun Saya)' : ''}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
            {isCashierRole && selectedCashier === currentUser?.name && (
              <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-black shrink-0 whitespace-nowrap ml-auto sm:ml-0 mr-4">
                Akun Saya
              </span>
            )}
          </div>
        </div>

        <span className="text-xs font-bold text-slate-500 self-end sm:self-auto">
          Total: <strong className="text-slate-900 font-mono">{filteredShifts.length}</strong> sesi shift
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
                  const cashierName = getShiftCashierName(shift);
                  const outletName = getShiftOutletName(shift);
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
                        {shift.notes && (
                          <div className="text-[10px] text-slate-500 font-medium truncate max-w-[200px] mt-0.5" title={shift.notes}>
                            📝 {shift.notes}
                          </div>
                        )}
                      </td>

                      {/* Modal Awal */}
                      <td className="px-5 py-4 text-right whitespace-nowrap font-medium font-mono text-slate-700">
                        Rp {startingCash.toLocaleString('id-ID')}
                      </td>

                      {/* Uang Fisik */}
                      <td className="px-5 py-4 text-right whitespace-nowrap font-semibold font-mono text-slate-900">
                        {actualCash != null
                          ? `Rp ${actualCash.toLocaleString('id-ID')}`
                          : expectedCash != null
                          ? `Rp ${expectedCash.toLocaleString('id-ID')} (Sistem)`
                          : '-'}
                      </td>

                      {/* Selisih */}
                      <td className="px-5 py-4 text-right whitespace-nowrap font-black font-mono">
                        {diff != null ? (
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-mono ${
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
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-900 text-blue-900 hover:text-white rounded-xl text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
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
              const cashierName = getShiftCashierName(shift);
              const outletName = getShiftOutletName(shift);
              const isMe = isCashierRole && currentUser?.name === cashierName;
              const startingCash = Number(shift.startingCash || 0);
              const expectedCash = shift.expectedEnding != null ? Number(shift.expectedEnding) : (shift.expectedCash != null ? Number(shift.expectedCash) : null);
              const actualCash = shift.actualEnding != null ? Number(shift.actualEnding) : (shift.actualCash != null ? Number(shift.actualCash) : null);
              const diff = shift.cashDifference != null ? Number(shift.cashDifference) : (shift.difference != null ? Number(shift.difference) : null);
              const isDiffZero = diff === 0;
              const isDiffPositive = (diff || 0) > 0;
              const isClosed = shift.status === 'CLOSED' || shift.status === 'MATCH' || shift.status === 'OVER' || shift.status === 'SHORT';

              return (
                <div key={shift.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                        <User className="w-4 h-4 text-blue-900 shrink-0" />
                        <span className="truncate">{cashierName}</span>
                        {isMe && (
                          <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-black shrink-0">
                            Akun Saya
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-slate-400 pl-6 block truncate">{outletName}</span>
                    </div>

                    {!isClosed && shift.status === 'OPEN' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-black uppercase shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>AKTIF</span>
                      </span>
                    ) : isDiffZero ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase shrink-0 border border-emerald-200">
                        SEIMBANG (Rp 0)
                      </span>
                    ) : isDiffPositive ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase shrink-0 border border-blue-200">
                        LEBIH (+Rp {Math.abs(diff!).toLocaleString('id-ID')})
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 text-[10px] font-bold uppercase shrink-0 border border-rose-200">
                        KURANG (-Rp {Math.abs(diff!).toLocaleString('id-ID')})
                      </span>
                    )}
                  </div>

                  {/* Waktu Shift */}
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5 bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      {new Date(shift.startTime).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} •{' '}
                      {new Date(shift.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} -{' '}
                      {shift.endTime
                        ? new Date(shift.endTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
                        : 'Sekarang'}
                    </span>
                  </div>

                  {/* Financial Metrics Mini Cards (Compact 4 Grid) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50/70 p-2.5 rounded-2xl border border-slate-100 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Modal Awal</span>
                      <span className="text-xs font-bold font-mono text-slate-700">
                        Rp {startingCash.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Kas Sistem</span>
                      <span className="text-xs font-bold font-mono text-slate-700">
                        {expectedCash != null ? `Rp ${expectedCash.toLocaleString('id-ID')}` : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Uang Fisik</span>
                      <span className="text-xs font-bold font-mono text-slate-900">
                        {actualCash != null ? `Rp ${actualCash.toLocaleString('id-ID')}` : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Selisih Kas</span>
                      {diff != null ? (
                        <span
                          className={`text-xs font-black font-mono ${
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

                  {shift.notes && (
                    <div className="text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200/80 truncate">
                      <span className="font-bold text-slate-700">Catatan: </span>
                      <span>{shift.notes}</span>
                    </div>
                  )}

                  {/* Action Button */}
                  <button
                    onClick={() => handleViewDetail(shift.id)}
                    className="w-full py-2.5 bg-blue-50 hover:bg-blue-900 text-blue-900 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
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
      </>
      ) : activeTab === 'AUDIT_TRAIL' ? (
        <GlobalAuditTrailPanel activeOutlet={activeOutlet} />
      ) : (
        <div className="space-y-6">
          {/* Summary KPI Cards Setoran Kas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Card 1: Menunggu Verifikasi */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                  Menunggu Verifikasi
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold shrink-0">
                  <Clock className="w-5 h-5 stroke-[2.5] shrink-0" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black font-mono text-amber-700 tracking-tight">
                  Rp {(depositSummary?.totalPendingAmount || 0).toLocaleString('id-ID')}
                </h3>
                <p className="text-[11px] text-amber-600 mt-1 font-medium">
                  <span className="font-mono">{depositSummary?.pendingCount || 0}</span> pengajuan setoran aktif
                </p>
              </div>
            </div>

            {/* Card 2: Terverifikasi Bulan Ini */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                  Terverifikasi (Bulan Ini)
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-bold shrink-0">
                  <Check className="w-5 h-5 stroke-[2.5] shrink-0" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-2xl font-black font-mono text-emerald-700 tracking-tight">
                  Rp {(depositSummary?.totalVerifiedMonthAmount || 0).toLocaleString('id-ID')}
                </h3>
                <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                  <span className="font-mono">{depositSummary?.verifiedCount || 0}</span> setoran masuk brankas/bank
                </p>
              </div>
            </div>

            {/* Card 3: Outlet / Toko Aktif */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                  Toko / Outlet
                </span>
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold shrink-0">
                  <Store className="w-5 h-5 stroke-[2.5] shrink-0" />
                </div>
              </div>
              <div className="mt-3">
                <h3 className="text-xl font-black text-slate-900 tracking-tight truncate">
                  {activeOutlet && !activeOutlet.isWarehouse ? activeOutlet.name : 'Seluruh Toko'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 font-medium">
                  Pusat verifikasi setoran kasir
                </p>
              </div>
            </div>
          </div>

          {/* Filter Toolbar & Actions */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 no-print">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 w-full sm:max-w-xl">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Cari kasir, no. referensi, catatan..."
                  value={depositSearch}
                  onChange={(e) => setDepositSearch(e.target.value)}
                  className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-900 shadow-xs"
                />
              </div>

              {/* Status Filter */}
              <div className="relative w-full sm:w-48 shrink-0">
                <select
                  value={depositStatusFilter}
                  onChange={(e) => {
                    setDepositStatusFilter(e.target.value);
                    setDepositCurrentPage(1);
                  }}
                  className="w-full h-10 pl-3.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none appearance-none cursor-pointer focus:border-blue-900 shadow-xs"
                >
                  <option value="ALL">Semua Status</option>
                  <option value="PENDING">Menunggu Verifikasi</option>
                  <option value="VERIFIED">Terverifikasi</option>
                  <option value="REJECTED">Ditolak</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              onClick={() => {
                setSelectedShiftForDeposit(shifts[0]?.id || '');
                setShowCreateDepositModal(true);
              }}
              className="w-full sm:w-auto h-10 px-4 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer shrink-0 whitespace-nowrap"
            >
              <Plus className="w-4 h-4 stroke-[2.5] shrink-0" />
              <span>Ajukan Setoran Kas</span>
            </button>
          </div>

          {/* Table of Shift Cash Deposits */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Waktu Pengajuan</th>
                    <th className="px-5 py-3.5">Toko / Outlet</th>
                    <th className="px-5 py-3.5">Kasir &amp; Shift</th>
                    <th className="px-5 py-3.5 text-right">Nominal Setoran</th>
                    <th className="px-5 py-3.5">Akun Tujuan</th>
                    <th className="px-5 py-3.5">No. Referensi / Catatan</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Verifikator</th>
                    <th className="px-5 py-3.5 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingDeposits ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-900" />
                        <span>Memuat data setoran kas...</span>
                      </td>
                    </tr>
                  ) : filteredDeposits.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                        <Landmark className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        <p className="font-bold text-slate-600">Belum ada riwayat setoran kas</p>
                        <p className="text-[11px] mt-0.5">Kasir dapat menyetorkan uang fisik laci kasir ke rekening bank atau kas besar pusat.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredDeposits.map((d: any) => {
                      const isPending = d.status === 'PENDING';
                      const isVerified = d.status === 'VERIFIED';
                      const isRejected = d.status === 'REJECTED';

                      return (
                        <tr key={d.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="font-bold text-slate-800 block">
                              {new Date(d.createdAt).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                            <span className="text-[11px] text-slate-400">
                              {new Date(d.createdAt).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="font-bold text-slate-800 block">
                              {d.outlet?.name || '-'}
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="font-bold text-slate-800 block">
                              {d.cashier?.name || 'Kasir'}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              Shift #{d.shiftId.slice(0, 8)}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap">
                            <span className="font-black font-mono text-sm text-blue-900">
                              Rp {Number(d.amount).toLocaleString('id-ID')}
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-900 font-bold text-[11px]">
                              {TARGET_ACCOUNTS_MAP[d.targetAccount] || d.targetAccount}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            {d.referenceNumber && (
                              <div className="font-mono text-xs font-bold text-slate-700">
                                Ref: {d.referenceNumber}
                              </div>
                            )}
                            {d.notes && (
                              <div className="text-[11px] text-slate-500 truncate max-w-xs">
                                {d.notes}
                              </div>
                            )}
                            {!d.referenceNumber && !d.notes && (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            {isPending && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Menunggu
                              </span>
                            )}
                            {isVerified && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                <Check className="w-3 h-3" /> Terverifikasi
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 inline-flex items-center gap-1">
                                <XCircle className="w-3 h-3" /> Ditolak
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-xs">
                            {d.verifier ? (
                              <div>
                                <span className="font-bold text-slate-700 block">{d.verifier.name}</span>
                                {d.verifiedAt && (
                                  <span className="text-[10px] text-slate-400">
                                    {new Date(d.verifiedAt).toLocaleDateString('id-ID')}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                            {d.rejectionReason && (
                              <span className="text-[10px] text-rose-600 block mt-0.5">
                                Alasan: {d.rejectionReason}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 text-center whitespace-nowrap">
                            {isPending && canVerify ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => handleVerifyDeposit(d.id)}
                                  disabled={verifyingId === d.id}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  title="Verifikasi dan terima kas masuk"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Verifikasi</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectingDepositId(d.id);
                                    setRejectionReason('');
                                  }}
                                  disabled={verifyingId === d.id}
                                  className="px-2.5 py-1.5 bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 rounded-lg text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  title="Tolak setoran kas"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Tolak</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs font-normal">Selesai</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View */}
            <div className="md:hidden divide-y divide-slate-100">
              {loadingDeposits ? (
                <div className="p-8 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-900" />
                  <span>Memuat setoran kas...</span>
                </div>
              ) : filteredDeposits.length === 0 ? (
                <div className="p-8 text-center text-slate-400">
                  <Landmark className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="font-bold text-slate-600 text-xs">Belum ada setoran kas</p>
                </div>
              ) : (
                filteredDeposits.map((d: any) => {
                  const isPending = d.status === 'PENDING';
                  return (
                    <div key={d.id} className="p-4 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-900 text-xs block">
                            {d.cashier?.name || 'Kasir'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {new Date(d.createdAt).toLocaleString('id-ID')}
                          </span>
                        </div>
                        {d.status === 'PENDING' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Menunggu
                          </span>
                        ) : d.status === 'VERIFIED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            Terverifikasi
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
                            Ditolak
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Tujuan</span>
                          <span className="text-xs font-bold text-slate-700">
                            {TARGET_ACCOUNTS_MAP[d.targetAccount] || d.targetAccount}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">Nominal Setor</span>
                          <span className="text-sm font-black font-mono text-blue-900">
                            Rp {Number(d.amount).toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>

                      {d.referenceNumber && (
                        <div className="text-[11px] text-slate-600">
                          <strong>No. Ref:</strong> <span className="font-mono">{d.referenceNumber}</span>
                        </div>
                      )}

                      {d.notes && (
                        <div className="text-[11px] text-slate-500 italic bg-white p-2 rounded-lg border border-slate-100">
                          {d.notes}
                        </div>
                      )}

                      {isPending && canVerify && (
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            onClick={() => handleVerifyDeposit(d.id)}
                            disabled={verifyingId === d.id}
                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Verifikasi</span>
                          </button>
                          <button
                            onClick={() => {
                              setRejectingDepositId(d.id);
                              setRejectionReason('');
                            }}
                            disabled={verifyingId === d.id}
                            className="flex-1 py-2 bg-white border border-rose-300 text-rose-700 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Tolak</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Setoran Kas */}
            {!loadingDeposits && totalDepositRecords > 0 && (
              <TablePagination
                currentPage={depositCurrentPage}
                pageSize={depositPageSize}
                totalItems={totalDepositRecords}
                onPageChange={setDepositCurrentPage}
                onPageSizeChange={setDepositPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
                itemLabel="setoran"
              />
            )}
          </div>
        </div>
      )}

      {/* Modal Ajukan Setoran Kas (Mobile Bottom Sheet + Sticky Action Footer) */}
      {showCreateDepositModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-lg max-h-[92dvh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold">
                  <Landmark className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-base">Ajukan Setoran Kas</h3>
                  <p className="text-xs text-slate-500">Setorkan kas fisik ke brankas pusat / rekening bank</p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateDepositModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmitDeposit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="overflow-y-auto overscroll-contain flex-1 p-5 space-y-4">
                {/* Pilih Sesi Shift */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Sesi Shift Kasir <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={selectedShiftForDeposit}
                      onChange={(e) => setSelectedShiftForDeposit(e.target.value)}
                      required
                      className="w-full h-11 px-3.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none appearance-none cursor-pointer focus:border-blue-900"
                    >
                      <option value="">-- Pilih Sesi Shift --</option>
                      {shifts.map((s) => {
                        const cName = getShiftCashierName(s);
                        const actualCash = s.actualEnding ?? s.expectedEnding ?? 0;
                        const dateStr = new Date(s.startTime).toLocaleDateString('id-ID');
                        return (
                          <option key={s.id} value={s.id}>
                            Kasir: {cName} | Uang Kas: Rp {Number(actualCash).toLocaleString('id-ID')} ({dateStr})
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Nominal Setoran */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Nominal Disetor (Rp) <span className="text-rose-500">*</span>
                  </label>
                  <CurrencyInput
                    value={depositAmount}
                    onChange={setDepositAmount}
                    placeholder="0"
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black font-mono text-blue-900 focus:outline-none focus:border-blue-900"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Masukkan jumlah uang kas fisik yang diserahkan/ditransfer.
                  </p>
                </div>

                {/* Akun / Rekening Tujuan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Rekening / Akun Tujuan <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={depositTargetAccount}
                      onChange={(e) => setDepositTargetAccount(e.target.value)}
                      required
                      className="w-full h-11 px-3.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none appearance-none cursor-pointer focus:border-blue-900"
                    >
                      {Object.entries(TARGET_ACCOUNTS_MAP).map(([key, label]) => (
                        <option key={key} value={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Nomor Referensi / Transfer */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    No. Referensi / Bukti Transfer (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: TRF-83921 / Ref ATM / Tanda Terima"
                    value={depositReference}
                    onChange={(e) => setDepositReference(e.target.value)}
                    className="w-full h-11 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-900"
                  />
                </div>

                {/* Catatan Tambahan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Catatan Tambahan
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Keterangan singkat..."
                    value={depositNotes}
                    onChange={(e) => setDepositNotes(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-900 resize-none"
                  />
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateDepositModal(false)}
                  className="h-10 px-4 rounded-xl border border-slate-200 bg-white font-bold text-xs text-slate-600 hover:bg-slate-100 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingDeposit || !depositAmount || depositAmount <= 0}
                  className="h-10 px-5 bg-blue-900 hover:bg-blue-800 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-900/20 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  {submittingDeposit ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                      <span>Mengirim...</span>
                    </>
                  ) : (
                    <span>Kirim Setoran</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tolak Setoran Kas */}
      {rejectingDepositId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md max-h-[92dvh] sm:max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold shrink-0">
                  <XCircle className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 text-base truncate">Tolak Setoran Kas</h3>
                  <p className="text-xs text-slate-500 truncate">Berikan alasan penolakan pengajuan setoran kas</p>
                </div>
              </div>
              <button
                onClick={() => setRejectingDepositId(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3 overflow-y-auto overscroll-contain flex-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Alasan Penolakan <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                required
                placeholder="Contoh: Uang fisik belum diterima di rekening BCA pusat / nominal berbeda Rp 50.000..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-rose-600 resize-none"
              />
            </div>

            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setRejectingDepositId(null)}
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white font-bold text-xs text-slate-600 hover:bg-slate-100 transition-all cursor-pointer whitespace-nowrap flex items-center justify-center"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleRejectDeposit}
                disabled={!rejectionReason.trim()}
                className="h-10 px-5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-md shadow-rose-600/20 transition-all disabled:opacity-50 cursor-pointer whitespace-nowrap flex items-center justify-center"
              >
                Tolak Setoran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Shift Modal */}
      {selectedShift && (() => {
        const modalDiff =
          selectedShift.difference != null
            ? Number(selectedShift.difference)
            : selectedShift.cashDifference != null
            ? Number(selectedShift.cashDifference)
            : null;
        const isModalClosed =
          selectedShift.status === 'CLOSED' ||
          selectedShift.status === 'MATCH' ||
          selectedShift.status === 'OVER' ||
          selectedShift.status === 'SHORT';
        const cashierName =
          selectedShift.cashier?.name ||
          selectedShift.user?.name ||
          selectedShift.cashierName ||
          'Kasir';
        const outletName =
          selectedShift.outlet?.name || selectedShift.outletName || '-';

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh] min-h-0">
              {/* Header Bar */}
              <div className="bg-gradient-to-r from-blue-950 to-blue-900 text-white p-4 sm:p-5 flex items-start justify-between gap-3 shrink-0">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-800/80 text-[10px] font-bold text-blue-200 uppercase tracking-wide">
                      Shift #{selectedShift.id.slice(0, 8)}
                    </span>
                    {!isModalClosed && selectedShift.status === 'OPEN' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black border border-emerald-400/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        AKTIF
                      </span>
                    ) : modalDiff === 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30">
                        SEIMBANG (Rp 0)
                      </span>
                    ) : (modalDiff || 0) > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-400/20 text-blue-200 text-[10px] font-bold border border-blue-400/30">
                        LEBIH (+Rp {Math.abs(modalDiff!).toLocaleString('id-ID')})
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-400/30">
                        KURANG (-Rp {Math.abs(modalDiff!).toLocaleString('id-ID')})
                      </span>
                    )}
                  </div>
                  <h3 className="font-extrabold text-base sm:text-lg text-white truncate">
                    Rekap Shift: {cashierName}
                  </h3>
                  <p className="text-xs text-blue-200/80 mt-0.5 truncate flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5 shrink-0" />
                    <span>{outletName}</span>
                    <span>•</span>
                    <span>
                      {new Date(selectedShift.startTime).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                      })}
                      ,{' '}
                      {new Date(selectedShift.startTime).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}{' '}
                      -{' '}
                      {selectedShift.endTime
                        ? new Date(selectedShift.endTime).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : 'Sekarang'}
                    </span>
                  </p>
                </div>
                <button
                  onClick={() => setSelectedShift(null)}
                  className="p-2 rounded-xl text-blue-200 hover:text-white hover:bg-blue-800/60 transition-colors shrink-0 cursor-pointer active:scale-95"
                  title="Tutup Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body Container */}
              <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-5 sm:space-y-6 min-h-0">
                {/* Reconciliation Cards (Compact 6 Grid) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Modal Awal</span>
                    <span className="text-xs sm:text-sm font-black font-mono text-slate-900 block mt-0.5">
                      Rp {Number(selectedShift.startingCash || 0).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Penjualan Tunai</span>
                    <span className="text-xs sm:text-sm font-black font-mono text-emerald-700 block mt-0.5">
                      Rp {Number(selectedShift.stats?.cashSales || 0).toLocaleString('id-ID')}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Kas Sistem (Expected)</span>
                    <span className="text-xs sm:text-sm font-black font-mono text-slate-900 block mt-0.5">
                      {selectedShift.expectedCash != null
                        ? `Rp ${Number(selectedShift.expectedCash).toLocaleString('id-ID')}`
                        : selectedShift.expectedEnding != null
                        ? `Rp ${Number(selectedShift.expectedEnding).toLocaleString('id-ID')}`
                        : '-'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Uang Fisik Aktual</span>
                    <span className="text-xs sm:text-sm font-black font-mono text-slate-900 block mt-0.5">
                      {selectedShift.actualCash != null
                        ? `Rp ${Number(selectedShift.actualCash).toLocaleString('id-ID')}`
                        : selectedShift.actualEnding != null
                        ? `Rp ${Number(selectedShift.actualEnding).toLocaleString('id-ID')}`
                        : '-'}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Penjualan Non-Tunai</span>
                    <span className="text-xs sm:text-sm font-black font-mono text-blue-700 block mt-0.5">
                      Rp {Number(selectedShift.stats?.nonCashSales ?? selectedShift.stats?.qrisSales ?? 0).toLocaleString('id-ID')}
                    </span>
                    {selectedShift.stats?.paymentBreakdown &&
                      Object.keys(selectedShift.stats.paymentBreakdown).filter((k: string) => k !== 'CASH').length > 1 && (
                        <span
                          className="text-[9px] text-slate-500 font-medium font-mono block mt-0.5 truncate"
                          title={Object.entries(selectedShift.stats.paymentBreakdown)
                            .filter(([k]) => k !== 'CASH')
                            .map(([k, v]) => `${k}: Rp ${Number(v).toLocaleString('id-ID')}`)
                            .join(' • ')}
                        >
                          {Object.entries(selectedShift.stats.paymentBreakdown)
                            .filter(([k]) => k !== 'CASH')
                            .map(([k, v]) => `${k}: Rp ${Number(v).toLocaleString('id-ID')}`)
                            .join(' • ')}
                        </span>
                      )}
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Selisih Kas</span>
                    <span
                      className={`text-xs sm:text-sm font-black font-mono block mt-0.5 ${
                        modalDiff === 0
                          ? 'text-emerald-700'
                          : (modalDiff || 0) > 0
                          ? 'text-blue-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {modalDiff !== null
                        ? `${(modalDiff || 0) > 0 ? '+' : ''}Rp ${modalDiff.toLocaleString('id-ID')}`
                        : 'Shift Aktif'}
                    </span>
                  </div>
                </div>

                {/* Catatan Kasir jika ada */}
                {selectedShift.notes && (
                  <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-2.5 text-xs">
                    <FileText className="w-4 h-4 text-blue-900 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <span className="font-extrabold text-blue-950 block text-[11px] uppercase tracking-wider mb-0.5">
                        Catatan Kasir
                      </span>
                      <p className="text-slate-700 whitespace-pre-wrap leading-relaxed font-medium">
                        {selectedShift.notes}
                      </p>
                    </div>
                  </div>
                )}

              {/* Rekap Item Terjual Selama Shift */}
              <div>
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
                  <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    {isLaundryMode ? (
                      <Shirt className="w-3.5 h-3.5 text-blue-900 shrink-0" />
                    ) : (
                      <UtensilsCrossed className="w-3.5 h-3.5 text-blue-900 shrink-0" />
                    )}
                    <span>
                      {isLaundryMode ? 'Rekap Layanan Terjual' : 'Rekap Item Terjual'} ({selectedShift.soldItemsSummary?.length || 0} {isLaundryMode ? 'Layanan' : 'Menu'})
                    </span>
                  </h4>
                  {selectedShift.soldItemsSummary && selectedShift.soldItemsSummary.length > 0 && (
                    <span className="text-[11px] font-bold text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200 font-mono whitespace-nowrap shrink-0">
                      Total: {selectedShift.soldItemsSummary.reduce((acc: number, cur: any) => acc + (cur.quantity || 0), 0)} {isLaundryMode ? 'Layanan/Item' : 'Porsi/Item'}
                    </span>
                  )}
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-x-auto max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs min-w-[360px]">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase sticky top-0">
                      <tr>
                        <th className="px-3.5 py-2">{isLaundryMode ? 'Nama Layanan / Paket' : 'Nama Menu / Produk'}</th>
                        <th className="px-3.5 py-2 text-center">Jumlah Terjual</th>
                        <th className="px-3.5 py-2 text-right">Total Penjualan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(!selectedShift.soldItemsSummary || selectedShift.soldItemsSummary.length === 0) ? (
                        <tr>
                          <td colSpan={3} className="px-3 py-6 text-center text-slate-400 text-xs">
                            Belum ada rincian item terjual pada shift ini
                          </td>
                        </tr>
                      ) : (
                        selectedShift.soldItemsSummary.map((item: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/70">
                            <td className="px-3.5 py-2 font-bold text-slate-800 flex items-center gap-2">
                              <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-900 flex items-center justify-center text-[10px] font-black shrink-0">
                                {idx + 1}
                              </span>
                              <span>{item.productName}</span>
                            </td>
                            <td className="px-3.5 py-2 text-center">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 font-extrabold text-[11px] font-mono">
                                {item.quantity} pcs
                              </span>
                            </td>
                            <td className="px-3.5 py-2 text-right font-black font-mono text-blue-950">
                              Rp {Number(item.totalAmount).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Orders List in this shift (Hybrid Desktop Table / Mobile Card Rows) */}
              <div>
                <h4 className="font-extrabold text-xs text-slate-800 uppercase tracking-wider mb-2.5">
                  Daftar Transaksi Selama Shift ({selectedShift.orders?.length || 0})
                </h4>
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto">
                  {/* Desktop View Table */}
                  <table className="w-full text-left text-xs hidden sm:table">
                    <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase sticky top-0">
                      <tr>
                        <th className="px-3.5 py-2">No. Faktur</th>
                        <th className="px-3.5 py-2">Waktu</th>
                        <th className="px-3.5 py-2">Metode</th>
                        <th className="px-3.5 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {!selectedShift.orders || selectedShift.orders.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-slate-400 text-xs">
                            Belum ada transaksi di shift ini
                          </td>
                        </tr>
                      ) : (
                        selectedShift.orders.map((ord: any) => (
                          <tr key={ord.id} className="hover:bg-slate-50">
                            <td className="px-3.5 py-2 font-bold font-mono text-slate-800">{ord.invoiceNumber}</td>
                            <td className="px-3.5 py-2 text-slate-500">
                              {new Date(ord.createdAt).toLocaleTimeString('id-ID', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="px-3.5 py-2">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-extrabold text-slate-700">
                                {ord.paymentMethod || ord.payments?.[0]?.method || 'CASH'}
                              </span>
                            </td>
                            <td className="px-3.5 py-2 text-right font-black font-mono text-blue-900">
                              Rp {Number(ord.grandTotal).toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  {/* Mobile View Clean Row Items */}
                  <div className="divide-y divide-slate-100 sm:hidden">
                    {!selectedShift.orders || selectedShift.orders.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 text-xs">
                        Belum ada transaksi di shift ini
                      </div>
                    ) : (
                      selectedShift.orders.map((ord: any) => (
                        <div key={ord.id} className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50">
                          <div className="min-w-0">
                            <span className="font-bold font-mono text-xs text-slate-800 block truncate">
                              {ord.invoiceNumber}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[11px] text-slate-400">
                                {new Date(ord.createdAt).toLocaleTimeString('id-ID', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              <span className="px-1.5 py-0.2 rounded bg-slate-100 text-[10px] font-extrabold text-slate-600">
                                {ord.paymentMethod || ord.payments?.[0]?.method || 'CASH'}
                              </span>
                            </div>
                          </div>
                          <span className="font-black font-mono text-xs text-blue-900 shrink-0 text-right">
                            Rp {Number(ord.grandTotal).toLocaleString('id-ID')}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
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
                            <td className="px-3 py-2 text-right font-black font-mono text-emerald-700">
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

            {/* Sticky Action Footer (Safe Area iPhone Compliant) */}
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500 font-medium hidden sm:block truncate">
                <span>Shift ID: </span>
                <strong className="text-slate-800 font-mono">#{selectedShift.id.slice(0, 8)}</strong>
              </div>
              <button
                onClick={() => setSelectedShift(null)}
                className="w-full sm:w-auto px-6 py-2.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-900/20 transition-all cursor-pointer active:scale-95 text-center"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      );
    })()}
    </div>
  );
};
