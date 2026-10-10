import React, { useState, useEffect } from 'react';
import {
  Search,
  Eye,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Phone,
  Receipt,
  DollarSign,
  CreditCard,
  Banknote,
  QrCode,
  X,
  Loader2,
  MessageCircle,
} from 'lucide-react';
import { api } from '../services/api';
import type { CustomerDebt, CustomerDebtStatus, CustomerDebtSummaryStats } from '../types/customer';
import type { Outlet } from '../types/outlet';
import { CurrencyInput } from './ui/CurrencyInput';
import { TablePagination } from './TablePagination';
import { TableSkeleton, EmptyState } from './ui';
import { useDialog } from '../context/DialogContext';

interface CustomerDebtsTabProps {
  activeOutlet?: Outlet | null;
}

export const CustomerDebtsTab: React.FC<CustomerDebtsTabProps> = ({ activeOutlet }) => {
  const dialog = useDialog();

  // Data & Loading States
  const [debts, setDebts] = useState<CustomerDebt[]>([]);
  const [summary, setSummary] = useState<CustomerDebtSummaryStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filter & Search
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL'); // ALL, UNPAID, PARTIAL, PAID

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [totalRecords, setTotalRecords] = useState<number>(0);

  // Detail Modal
  const [selectedDebtDetail, setSelectedDebtDetail] = useState<CustomerDebt | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Payment Settlement Modal
  const [settlementDebt, setSettlementDebt] = useState<CustomerDebt | null>(null);
  const [isPayModalOpen, setIsPayModalOpen] = useState<boolean>(false);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'QRIS'>('CASH');
  const [payNotes, setPayNotes] = useState<string>('');
  const [payReference, setPayReference] = useState<string>('');
  const [submittingPay, setSubmittingPay] = useState<boolean>(false);

  // Fetch Debts List
  const fetchDebts = async () => {
    setLoading(true);
    try {
      const outletIdParam = activeOutlet && !activeOutlet.isWarehouse ? activeOutlet.id : undefined;
      const res = await api.getCustomerDebts({
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        outletId: outletIdParam,
        page: currentPage,
        limit: pageSize,
      });

      if (res.status === 'success') {
        setDebts(res.data || []);
        if (res.summary) setSummary(res.summary);
        if (res.meta) {
          setTotalRecords(res.meta.totalRecords || 0);
        }
      }
    } catch (err) {
      console.error('Gagal mengambil data piutang pelanggan:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDebts();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, statusFilter, currentPage, pageSize, activeOutlet?.id]);

  // Auto-reset page 1 on search or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, activeOutlet?.id]);

  // Open Detail Modal
  const handleOpenDetail = async (debt: CustomerDebt) => {
    setIsDetailModalOpen(true);
    setLoadingDetail(true);
    setSelectedDebtDetail(debt);
    try {
      const res = await api.getCustomerDebtDetail(debt.id);
      if (res.status === 'success' && res.data) {
        setSelectedDebtDetail(res.data);
      }
    } catch (err) {
      console.error('Gagal memuat detail piutang:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Open Settlement Modal
  const handleOpenPay = (debt: CustomerDebt) => {
    setSettlementDebt(debt);
    setPayAmount(debt.remainingAmount);
    setPayMethod('CASH');
    setPayNotes('');
    setPayReference('');
    setIsPayModalOpen(true);
  };

  // Submit Settlement
  const handleSubmitPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlementDebt) return;

    if (payAmount <= 0) {
      dialog.toast('Nominal pembayaran harus lebih dari 0', 'error');
      return;
    }

    if (payAmount > settlementDebt.remainingAmount) {
      dialog.toast(`Nominal pembayaran maksimal Rp ${settlementDebt.remainingAmount.toLocaleString('id-ID')}`, 'error');
      return;
    }

    setSubmittingPay(true);
    try {
      const res = await api.payCustomerDebt(settlementDebt.id, {
        amount: payAmount,
        paymentMethod: payMethod,
        notes: payNotes.trim() || undefined,
        referenceNumber: payReference.trim() || undefined,
      });

      if (res.status === 'success') {
        dialog.toast('Pembayaran piutang berhasil dicatat!', 'success');
        setIsPayModalOpen(false);
        setSettlementDebt(null);
        // Refresh list
        fetchDebts();
        // If detail modal is also open, refresh it or close it
        if (isDetailModalOpen && selectedDebtDetail?.id === settlementDebt.id) {
          setIsDetailModalOpen(false);
        }
      } else {
        dialog.alert({
          title: 'Gagal Mencatat Pelunasan',
          message: res.message || 'Terjadi kesalahan saat memproses pelunasan.',
          variant: 'danger',
        });
      }
    } catch (err: any) {
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: err.message || 'Terjadi kesalahan sistem saat memproses pelunasan.',
        variant: 'danger',
      });
    } finally {
      setSubmittingPay(false);
    }
  };

  // Format WhatsApp Link
  const getWaLink = (phone?: string | null, customerName?: string, invoiceNo?: string, remaining?: number) => {
    if (!phone) return null;
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.slice(1);
    const text = encodeURIComponent(
      `Halo Kak ${customerName || ''}, kami dari ${activeOutlet?.name || 'Kasir'}. Mengingatkan faktur kasbon #${invoiceNo || ''} sebesar Rp ${(remaining || 0).toLocaleString('id-ID')}. Terima kasih banyak.`
    );
    return `https://wa.me/${clean}?text=${text}`;
  };

  // Check if overdue
  const isOverdue = (dueDate?: string | null, status?: CustomerDebtStatus) => {
    if (!dueDate || status === 'PAID' || status === 'CANCELLED') return false;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    return due < now;
  };

  return (
    <div className="space-y-6 pb-28 sm:pb-16 font-sans">
      {/* 1. KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Piutang Aktif */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-rose-200/80 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500 truncate">Sisa Piutang Aktif</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0">
              <Clock className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <div className="mt-2">
            <span className="font-mono text-xl sm:text-2xl font-black text-rose-600">
              Rp {(summary?.totalRemaining ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Belum terlunasi di pelanggan</p>
        </div>

        {/* Faktur Belum Lunas */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-amber-200/80 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500 truncate">Faktur Menunggak</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
              <AlertTriangle className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-mono text-2xl font-black text-amber-700">
              {summary?.unpaidCount ?? 0}
            </span>
            <span className="text-xs text-slate-400 font-semibold">Transaksi</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Status Belum Lunas / Cicilan</p>
        </div>

        {/* Total Terbayar */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-200/80 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500 truncate">Piutang Terbayar</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <div className="mt-2">
            <span className="font-mono text-xl sm:text-2xl font-black text-emerald-600">
              Rp {(summary?.totalPaid ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Berhasil ditagih &amp; masuk kas</p>
        </div>

        {/* Akumulasi Kasbon */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-500 truncate">Total Transaksi Kasbon</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center font-bold shrink-0">
              <Receipt className="w-4 h-4 shrink-0" />
            </div>
          </div>
          <div className="mt-2">
            <span className="font-mono text-xl sm:text-2xl font-black text-slate-900">
              Rp {(summary?.totalDebt ?? 0).toLocaleString('id-ID')}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">Akumulasi keseluruhan kasbon</p>
        </div>
      </div>

      {/* 2. Filter & Controls Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pelanggan, nomor telepon, atau nomor faktur..."
            className="w-full h-10 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-900 focus:bg-white transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { key: 'ALL', label: 'Semua' },
            { key: 'UNPAID', label: 'Belum Lunas' },
            { key: 'PARTIAL', label: 'Dicicil' },
            { key: 'PAID', label: 'Lunas' },
          ].map((st) => (
            <button
              key={st.key}
              type="button"
              onClick={() => setStatusFilter(st.key)}
              className={`h-10 px-3.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                statusFilter === st.key
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Table Data */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-6">
            <TableSkeleton rows={5} columns={6} />
          </div>
        ) : debts.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Tidak ada data kasbon"
              description={
                search || statusFilter !== 'ALL'
                  ? 'Tidak ada data piutang yang cocok dengan kriteria pencarian atau filter Anda.'
                  : 'Belum ada transaksi kasbon yang tercatat pada sistem.'
              }
              actionLabel={search || statusFilter !== 'ALL' ? 'Reset Filter' : undefined}
              onAction={
                search || statusFilter !== 'ALL'
                  ? () => {
                      setSearch('');
                      setStatusFilter('ALL');
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Faktur &amp; Tanggal</th>
                    <th className="py-3 px-4">Pelanggan</th>
                    <th className="py-3 px-4 text-right">Total Kasbon</th>
                    <th className="py-3 px-4 text-right">Terbayar</th>
                    <th className="py-3 px-4 text-right">Sisa Piutang</th>
                    <th className="py-3 px-4">Jatuh Tempo</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {debts.map((debt) => {
                    const overdue = isOverdue(debt.dueDate, debt.status);
                    return (
                      <tr key={debt.id} className="hover:bg-blue-50/30 transition-colors">
                        {/* Faktur & Tanggal */}
                        <td className="py-3.5 px-4">
                          <div className="font-mono font-bold text-slate-900">
                            {debt.order?.invoiceNumber || debt.id.slice(0, 8)}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{new Date(debt.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                          </div>
                          {debt.outlet?.name && (
                            <span className="text-[10px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-semibold inline-block mt-0.5">
                              {debt.outlet.name}
                            </span>
                          )}
                        </td>

                        {/* Pelanggan */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">
                            {debt.customer?.name || 'Pelanggan Toko'}
                          </div>
                          {debt.customer?.phone && (
                            <div className="flex items-center gap-1 font-mono text-[11px] text-slate-500 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{debt.customer.phone}</span>
                              {debt.remainingAmount > 0 && debt.status !== 'PAID' && (
                                <a
                                  href={getWaLink(debt.customer.phone, debt.customer.name, debt.order?.invoiceNumber, debt.remainingAmount) || '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-0.5 text-emerald-600 hover:text-emerald-700 font-bold ml-1"
                                  title="Kirim Tagihan via WhatsApp"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  <span>Tagih</span>
                                </a>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Total Kasbon */}
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-slate-600">
                          Rp {debt.totalAmount.toLocaleString('id-ID')}
                        </td>

                        {/* Terbayar */}
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-emerald-600">
                          Rp {debt.paidAmount.toLocaleString('id-ID')}
                        </td>

                        {/* Sisa Piutang */}
                        <td className="py-3.5 px-4 text-right">
                          <span className={`font-mono font-black ${debt.remainingAmount > 0 ? 'text-rose-600 text-sm' : 'text-slate-400'}`}>
                            Rp {debt.remainingAmount.toLocaleString('id-ID')}
                          </span>
                        </td>

                        {/* Jatuh Tempo */}
                        <td className="py-3.5 px-4">
                          {debt.dueDate ? (
                            <div>
                              <span className={`font-mono text-xs font-semibold ${overdue ? 'text-rose-600 font-black' : 'text-slate-600'}`}>
                                {new Date(debt.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                              </span>
                              {overdue && (
                                <span className="block text-[10px] text-rose-600 font-black animate-pulse">
                                  Lewat Jatuh Tempo!
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          {debt.status === 'PAID' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Lunas</span>
                            </span>
                          ) : debt.status === 'PARTIAL' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3 h-3" />
                              <span>Dicicil</span>
                            </span>
                          ) : debt.status === 'CANCELLED' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 border border-slate-200">
                              <span>Dibatalkan</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertTriangle className="w-3 h-3" />
                              <span>Belum Lunas</span>
                            </span>
                          )}
                        </td>

                        {/* Aksi */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenDetail(debt)}
                              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center justify-center"
                              title="Lihat Rincian Piutang"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {debt.remainingAmount > 0 && debt.status !== 'PAID' && (
                              <button
                                type="button"
                                onClick={() => handleOpenPay(debt)}
                                className="h-8 px-3 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs shadow-xs transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                              >
                                <DollarSign className="w-3.5 h-3.5" />
                                <span>Bayar</span>
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

            {/* Mobile Card List View */}
            <div className="block md:hidden divide-y divide-slate-100">
              {debts.map((debt) => {
                const overdue = isOverdue(debt.dueDate, debt.status);
                return (
                  <div key={debt.id} className="p-4 space-y-3 hover:bg-slate-50/70 transition-colors">
                    {/* Header: Invoice & Status */}
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="font-mono font-bold text-slate-900 text-xs block">
                          {debt.order?.invoiceNumber || debt.id.slice(0, 8)}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {new Date(debt.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div>
                        {debt.status === 'PAID' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Lunas</span>
                          </span>
                        ) : debt.status === 'PARTIAL' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3 h-3" />
                            <span>Dicicil</span>
                          </span>
                        ) : debt.status === 'CANCELLED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            <span>Dibatalkan</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3 h-3" />
                            <span>Belum Lunas</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Pelanggan Info */}
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-800 block">
                          {debt.customer?.name || 'Pelanggan Toko'}
                        </span>
                        {debt.customer?.phone && (
                          <span className="font-mono text-[11px] text-slate-500">
                            {debt.customer.phone}
                          </span>
                        )}
                      </div>
                      {debt.customer?.phone && debt.remainingAmount > 0 && debt.status !== 'PAID' && (
                        <a
                          href={getWaLink(debt.customer.phone, debt.customer.name, debt.order?.invoiceNumber, debt.remainingAmount) || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs hover:bg-emerald-100"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Tagih WA</span>
                        </a>
                      )}
                    </div>

                    {/* Financial Summary Box */}
                    <div className="grid grid-cols-3 gap-2 p-2.5 bg-slate-50 rounded-xl text-center">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold">Total</span>
                        <span className="font-mono text-xs font-semibold text-slate-700">
                          Rp {debt.totalAmount.toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold">Terbayar</span>
                        <span className="font-mono text-xs font-semibold text-emerald-600">
                          Rp {debt.paidAmount.toLocaleString('id-ID')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-bold">Sisa</span>
                        <span className={`font-mono text-xs font-black ${debt.remainingAmount > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                          Rp {debt.remainingAmount.toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>

                    {/* Due Date & Action */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <div className="text-[11px]">
                        {debt.dueDate ? (
                          <span className={`font-mono ${overdue ? 'text-rose-600 font-black' : 'text-slate-500 font-medium'}`}>
                            Tempo: {new Date(debt.dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                            {overdue && ' ⚠️'}
                          </span>
                        ) : (
                          <span className="text-slate-400">Tanpa tempo</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(debt)}
                          className="h-9 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                        >
                          Rincian
                        </button>
                        {debt.remainingAmount > 0 && debt.status !== 'PAID' && (
                          <button
                            type="button"
                            onClick={() => handleOpenPay(debt)}
                            className="h-9 px-3.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs shadow-xs"
                          >
                            Bayar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Canonical TablePagination */}
        <TablePagination
          currentPage={currentPage}
          pageSize={pageSize}
          totalItems={totalRecords}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="kasbon"
        />
      </div>

      {/* 4. MODAL DETAIL PIUTANG (Responsif PWA) */}
      {isDetailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col flex-1 min-h-0 overflow-hidden shadow-2xl border border-slate-200">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold shrink-0">
                  <Receipt className="w-5 h-5 shrink-0" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 text-lg">
                    Rincian Kasbon #{selectedDebtDetail?.order?.invoiceNumber || selectedDebtDetail?.id?.slice(0, 8)}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Histori pesanan dan mutasi pembayaran cicilan pelanggan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors shrink-0"
              >
                <X className="w-4 h-4 shrink-0" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-6">
              {loadingDetail ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-blue-900 animate-spin" />
                  <span className="text-xs text-slate-500 font-bold">Memuat rincian piutang...</span>
                </div>
              ) : selectedDebtDetail ? (
                <>
                  {/* Info Ringkas Pelanggan & Outlet */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/80">
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 block">Pelanggan</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 block mt-0.5">
                        {selectedDebtDetail.customer?.name || '-'}
                      </span>
                      {selectedDebtDetail.customer?.phone && (
                        <span className="text-[11px] text-slate-500 block">
                          {selectedDebtDetail.customer.phone}
                        </span>
                      )}
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 block">Outlet Toko</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 block mt-0.5">
                        {selectedDebtDetail.outlet?.name || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 block">Tanggal Transaksi</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 block mt-0.5">
                        {new Date(selectedDebtDetail.createdAt).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 block">Jatuh Tempo</span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900 block mt-0.5">
                        {selectedDebtDetail.dueDate
                          ? new Date(selectedDebtDetail.dueDate).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '-'}
                      </span>
                    </div>
                  </div>

                  {/* Summary Keuangan */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-500 block">Total Tagihan</span>
                      <span className="text-base font-black text-slate-900 mt-1 block">
                        Rp {selectedDebtDetail.totalAmount.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                      <span className="text-[11px] font-bold text-emerald-700 block">Total Terbayar</span>
                      <span className="text-base font-black text-emerald-700 mt-1 block">
                        Rp {selectedDebtDetail.paidAmount.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200">
                      <span className="text-[11px] font-bold text-rose-700 block">Sisa Piutang</span>
                      <span className="text-base font-black text-rose-700 mt-1 block">
                        Rp {selectedDebtDetail.remainingAmount.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>

                  {/* Catatan Tambahan */}
                  {selectedDebtDetail.notes && (
                    <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200/60 text-xs text-blue-900">
                      <span className="font-bold">Catatan Kasir:</span> {selectedDebtDetail.notes}
                    </div>
                  )}

                  {/* Rincian Produk dalam Pesanan */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Rincian Produk Pesanan
                    </h4>
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                          <tr>
                            <th className="py-2.5 px-3 text-left">Produk</th>
                            <th className="py-2.5 px-3 text-center">Qty</th>
                            <th className="py-2.5 px-3 text-right">Harga</th>
                            <th className="py-2.5 px-3 text-right">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(selectedDebtDetail.order as any)?.items?.map((it: any) => (
                            <tr key={it.id}>
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                {it.productVariant?.product?.name || it.productName || 'Produk'}
                                {it.productVariant?.name && it.productVariant?.name !== 'Default' && (
                                  <span className="text-[11px] text-slate-500 ml-1">({it.productVariant.name})</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-600">{it.quantity}</td>
                              <td className="py-2.5 px-3 text-right text-slate-600">
                                Rp {Number(it.price).toLocaleString('id-ID')}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                Rp {Number(it.subtotal).toLocaleString('id-ID')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Riwayat Pembayaran / Cicilan */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Riwayat Pembayaran Cicilan / Pelunasan
                    </h4>
                    {selectedDebtDetail.payments && selectedDebtDetail.payments.length > 0 ? (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                            <tr>
                              <th className="py-2.5 px-3 text-left">Waktu Pembayaran</th>
                              <th className="py-2.5 px-3 text-left">Metode</th>
                              <th className="py-2.5 px-3 text-left">Kasir</th>
                              <th className="py-2.5 px-3 text-right">Nominal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedDebtDetail.payments.map((p) => (
                              <tr key={p.id}>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {new Date(p.paidAt).toLocaleString('id-ID', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-800">
                                  {p.paymentMethod === 'CASH'
                                    ? 'Tunai'
                                    : p.paymentMethod === 'BANK_TRANSFER'
                                    ? 'Transfer'
                                    : p.paymentMethod === 'QRIS'
                                    ? 'QRIS'
                                    : p.paymentMethod}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600">
                                  {p.cashier?.name || '-'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-black text-emerald-600">
                                  Rp {p.amount.toLocaleString('id-ID')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs text-slate-500 font-medium">
                        Belum ada riwayat pembayaran yang dicatat untuk kasbon ini.
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="h-10 px-5 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Tutup
              </button>

              {selectedDebtDetail && selectedDebtDetail.remainingAmount > 0 && selectedDebtDetail.status !== 'PAID' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenPay(selectedDebtDetail);
                  }}
                  className="h-10 px-5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white font-bold text-xs shadow-sm hover:shadow transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Catat Pelunasan Sekarang</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. MODAL PELUNASAN PIUTANG (Responsif PWA & Zero Stacked Modals) */}
      {isPayModalOpen && settlementDebt && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col flex-1 min-h-0 overflow-hidden shadow-2xl border border-slate-200">
            {/* Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 text-lg">Pelunasan Kasbon / Piutang</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Faktur #{settlementDebt.order?.invoiceNumber || settlementDebt.id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors shrink-0"
              >
                <X className="w-4 h-4 shrink-0" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmitPay} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 sm:p-6 overflow-y-auto overscroll-contain flex-1 space-y-5">
                {/* Info Pelanggan & Sisa */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 block">Nama Pelanggan</span>
                    <span className="text-sm font-black text-slate-900 block mt-0.5">
                      {settlementDebt.customer?.name || 'Pelanggan Toko'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-bold text-slate-400 block">Sisa Tagihan</span>
                    <span className="text-base font-black text-rose-600 block mt-0.5">
                      Rp {settlementDebt.remainingAmount.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>

                {/* Nominal Input & Tombol Bayar Lunas */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">
                      Nominal Pembayaran (Rp) <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setPayAmount(settlementDebt.remainingAmount)}
                      className="text-xs font-bold text-blue-900 hover:underline"
                    >
                      Bayar Lunas (100%)
                    </button>
                  </div>
                  <CurrencyInput
                    value={payAmount}
                    onChange={(val) => setPayAmount(val)}
                    placeholder="0"
                    className="w-full text-base sm:text-lg font-black text-slate-900"
                  />
                  {payAmount < settlementDebt.remainingAmount && payAmount > 0 && (
                    <p className="text-[11px] text-amber-600 font-semibold mt-1">
                      Sisa kasbon setelah pembayaran ini: Rp{' '}
                      {(settlementDebt.remainingAmount - payAmount).toLocaleString('id-ID')}
                    </p>
                  )}
                </div>

                {/* Metode Pembayaran */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2">
                    Metode Pembayaran <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'CASH', label: 'Tunai', icon: Banknote },
                      { key: 'BANK_TRANSFER', label: 'Transfer', icon: CreditCard },
                      { key: 'QRIS', label: 'QRIS', icon: QrCode },
                    ].map((m) => {
                      const Icon = m.icon;
                      const active = payMethod === m.key;
                      return (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => setPayMethod(m.key as any)}
                          className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            active
                              ? 'border-blue-900 bg-blue-50/50 text-blue-900 font-black shadow-xs'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 font-bold'
                          }`}
                        >
                          <Icon className={`w-5 h-5 ${active ? 'text-blue-900' : 'text-slate-400'}`} />
                          <span className="text-xs">{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Notice Jika Tunai (Cash Movement Integrasi) */}
                {payMethod === 'CASH' && (
                  <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900">
                    <Banknote className="w-4 h-4 text-blue-900 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block">Sinkronisasi Laci Kasir Otomatis</span>
                      <p className="text-[11px] text-blue-800/90 mt-0.5 leading-relaxed">
                        Uang tunai pelunasan ini otomatis dicatat ke Laci Kasir shift kasir aktif saat ini sebagai <b>Cash-In (DEBT_REPAYMENT)</b> agar saldo fisik kasir tetap balance.
                      </p>
                    </div>
                  </div>
                )}

                {/* Nomor Referensi / Bukti (Untuk Transfer / QRIS) */}
                {payMethod !== 'CASH' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nomor Referensi / No. Transaksi (Opsional)
                    </label>
                    <input
                      type="text"
                      value={payReference}
                      onChange={(e) => setPayReference(e.target.value)}
                      placeholder="Contoh: TRF-BCA-981249"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                    />
                  </div>
                )}

                {/* Catatan Pelunasan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Catatan Pelunasan (Opsional)
                  </label>
                  <textarea
                    rows={2}
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    placeholder="Contoh: Pembayaran cicilan tahap 1 dititipkan kasir..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  disabled={submittingPay}
                  className="h-10 px-5 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingPay || payAmount <= 0}
                  className="h-10 px-6 rounded-xl bg-blue-900 hover:bg-blue-950 disabled:opacity-50 text-white font-bold text-xs shadow-sm hover:shadow transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  {submittingPay ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Konfirmasi Pembayaran Rp {payAmount.toLocaleString('id-ID')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
