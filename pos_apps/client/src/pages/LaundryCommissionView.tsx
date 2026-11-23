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
} from 'lucide-react';
import type { User } from '../types/auth';
import type { Outlet } from '../types/outlet';
import type {
  LaundryCommissionConfig,
  LaundryStaffCommissionRow,
  LaundryCommissionReport,
} from '../types/laundry';
import { api } from '../services/api';
import { formatRupiah } from '../utils/currency';
import { TablePagination } from '../components/TablePagination';
import { TableSkeleton } from '../components/ui/TableSkeleton';

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
    <div className="space-y-6 pb-12">
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
                    paginatedStaff.map((s, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {s.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-bold text-slate-900 block">{s.name}</span>
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                                  s.roleType === 'BOTH'
                                    ? 'bg-purple-100 text-purple-800'
                                    : s.roleType === 'COURIER'
                                    ? 'bg-indigo-100 text-indigo-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {s.roleType === 'BOTH'
                                  ? 'Operator & Kurir'
                                  : s.roleType === 'COURIER'
                                  ? 'Kurir Delivery'
                                  : 'Operator Produksi'}
                              </span>
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
                        </td>
                      </tr>
                    ))
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
                paginatedStaff.map((s, idx) => (
                  <div key={idx} className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {s.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-slate-900 text-xs block">{s.name}</span>
                          <span className="text-[10px] text-slate-500 font-medium">
                            {s.roleType === 'BOTH'
                              ? 'Operator & Kurir'
                              : s.roleType === 'COURIER'
                              ? 'Kurir Delivery'
                              : 'Operator Produksi'}
                          </span>
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
                      {s.rewashPenalty > 0 && (
                        <div>
                          <span className="text-rose-400 block">Penalti Rewash:</span>
                          <span className="font-bold text-rose-700">-{formatRupiah(s.rewashPenalty)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-1">
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
                ))
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
    </div>
  );
};
