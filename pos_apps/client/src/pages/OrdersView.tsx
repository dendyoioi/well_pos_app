import React, { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Search,
  RefreshCw,
  Printer,
  Banknote,
  QrCode,
  User,
  UserCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Calendar,
  ChevronDown,
  Ban,
  CheckCircle2,
  Eye,
  UtensilsCrossed,
  Clock,
  CreditCard,
  Building2,
  BookOpen,
  Layers,
} from 'lucide-react';
import type { Order, OrderChannel } from '../types/order';
import type { Outlet } from '../types/outlet';
import { normalizeSalesChannels } from '../types/outlet';
import { ORDER_CHANNEL_LABELS } from '../types/order';
import { OrderSuccessModal } from '../components/OrderSuccessModal';
import { VoidOrderModal } from '../components/VoidOrderModal';
import { VoidOrderItemModal } from '../components/VoidOrderItemModal';
import { OrderDetailModal } from '../components/OrderDetailModal';
import { TablePagination } from '../components/TablePagination';
import { generateSalesRecapPdf } from '../utils/salesRecapPdf';
import { exportOrdersToCsv } from '../utils/salesExportCsv';
import { EmptyState, TableSkeleton } from '../components/ui';
import { api } from '../services/api';

interface OrdersViewProps {
  activeOutlet?: Outlet | null;
  onAppendOrder?: (order: Order) => void;
}

type DatePreset = 'all' | 'today' | '7days' | '30days' | 'thismonth' | 'custom';
const PRESET_LABELS: Record<DatePreset, string> = {
  all: 'Semua Periode',
  today: 'Hari Ini',
  '7days': '7 Hari Terakhir',
  '30days': '30 Hari Terakhir',
  thismonth: 'Bulan Ini',
  custom: 'Kustom Tanggal',
};

import { toLocalDateStr, computePresetDateRange } from '../utils/date';

function getPresetRange(preset: DatePreset): { start?: string; end?: string } {
  if (preset === 'all') return {};
  const { startStr, endStr } = computePresetDateRange(preset as any);
  return { start: startStr, end: endStr };
}

export const OrdersView: React.FC<OrdersViewProps> = ({ activeOutlet, onAppendOrder }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [orderToVoid, setOrderToVoid] = useState<Order | null>(null);
  const [voidItemModalOpen, setVoidItemModalOpen] = useState(false);
  const [itemToVoid, setItemToVoid] = useState<any | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [orderForDetail, setOrderForDetail] = useState<Order | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleViewDetail = (order: Order) => {
    setOrderForDetail(order);
    setDetailModalOpen(true);
  };

  // Ambil hanya saluran penjualan yang aktif sesuai pengaturan outlet / kanal penjualan & mitra
  const channelOptions = useMemo(() => {
    const all = normalizeSalesChannels(activeOutlet?.channelsConfig);
    return all.filter((c) => c.isActive);
  }, [activeOutlet?.channelsConfig]);

  // Jika saluran yang sedang dipilih tidak lagi aktif (misal dinonaktifkan di pengaturan), reset ke 'ALL'
  useEffect(() => {
    if (selectedChannel !== 'ALL' && !channelOptions.some((c) => c.code === selectedChannel)) {
      setSelectedChannel('ALL');
      loadOrders('ALL');
    }
  }, [channelOptions, selectedChannel]);

  const getChannelEmoji = (code: string) => {
    switch (code) {
      case 'DINE_IN':
        return '🍽️';
      case 'TAKEAWAY':
        return '🛍️';
      case 'GOFOOD':
        return '🛵';
      case 'GRABFOOD':
        return '🟢';
      case 'SHOPEEFOOD':
        return '🟠';
      case 'DELIVERY':
        return '📦';
      default:
        return '🏷️';
    }
  };

  // Date Filter State (Default: Hari Ini)
  const [datePreset, setDatePreset] = useState<DatePreset>('today');
  const [customStart, setCustomStart] = useState(toLocalDateStr(new Date()));
  const [customEnd, setCustomEnd] = useState(toLocalDateStr(new Date()));
  const [showDateDrop, setShowDateDrop] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const loadOrders = async (
    targetChannel?: string,
    targetPreset?: DatePreset,
    startD?: string,
    endD?: string
  ) => {
    setLoading(true);
    try {
      const channelParam = targetChannel !== undefined ? targetChannel : selectedChannel;
      const currentPreset = targetPreset !== undefined ? targetPreset : datePreset;

      let sDate: string | undefined;
      let eDate: string | undefined;
      if (currentPreset === 'custom') {
        sDate = startD !== undefined ? startD : customStart;
        eDate = endD !== undefined ? endD : customEnd;
      } else {
        const range = getPresetRange(currentPreset);
        sDate = range.start;
        eDate = range.end;
      }

      const res = await api.getOrders({
        search: search.trim() || undefined,
        channel: channelParam,
        outletId: activeOutlet?.id,
        startDate: sDate,
        endDate: eDate,
        limit: 200,
      });
      if (res.status === 'success') {
        setOrders(res.data);
      }
    } catch (err) {
      console.error('Gagal mengambil daftar pesanan:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [activeOutlet?.id]);

  // Reset pagination ke halaman 1 saat filter atau pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedChannel, datePreset, customStart, customEnd]);

  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedOrders = orders.slice(
    (safeCurrentPage - 1) * pageSize,
    safeCurrentPage * pageSize
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadOrders();
  };

  const handleViewReceipt = (order: Order) => {
    setSelectedOrder(order);
    setModalOpen(true);
  };

  // Helper Render Badge Metode Pembayaran Akurat (Anti-Falsifikasi QRIS pada Order Unpaid)
  const renderPaymentMethodBadge = (order: Order, isCompact = false) => {
    if (order.orderStatus === 'VOIDED') {
      return (
        <span
          className={`inline-flex items-center gap-1 ${
            isCompact ? 'px-1.5 py-0.2 text-[10px]' : 'px-2.5 py-1 text-xs'
          } rounded-full bg-rose-50 text-rose-700 border border-rose-200 font-bold shrink-0`}
        >
          <Ban className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
          <span>Batal (Void)</span>
        </span>
      );
    }

    if (order.paymentStatus === 'UNPAID' || !order.payments || order.payments.length === 0) {
      return (
        <span
          className={`inline-flex items-center gap-1 ${
            isCompact ? 'px-1.5 py-0.2 text-[10px]' : 'px-2.5 py-1 text-xs'
          } rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-bold shrink-0`}
        >
          <Clock className={isCompact ? 'w-2.5 h-2.5 text-amber-600' : 'w-3 h-3 text-amber-600'} />
          <span>Belum Bayar</span>
        </span>
      );
    }

    if (order.paymentStatus === 'PARTIAL') {
      return (
        <span
          className={`inline-flex items-center gap-1 ${
            isCompact ? 'px-1.5 py-0.2 text-[10px]' : 'px-2.5 py-1 text-xs'
          } rounded-full bg-orange-50 text-orange-800 border border-orange-200 font-bold shrink-0`}
        >
          <Clock className={isCompact ? 'w-2.5 h-2.5 text-orange-600' : 'w-3 h-3 text-orange-600'} />
          <span>Sebagian</span>
        </span>
      );
    }

    if (order.payments.length > 1) {
      return (
        <span
          className={`inline-flex items-center gap-1 ${
            isCompact ? 'px-1.5 py-0.2 text-[10px]' : 'px-2.5 py-1 text-xs'
          } rounded-full bg-purple-50 text-purple-800 border border-purple-200 font-bold shrink-0`}
        >
          <Layers className={isCompact ? 'w-2.5 h-2.5 text-purple-600' : 'w-3 h-3 text-purple-600'} />
          <span>Split ({order.payments.length})</span>
        </span>
      );
    }

    const primaryPayment = order.payments[0];
    const method = (primaryPayment?.method || (primaryPayment as any)?.paymentMethod || '').toUpperCase();

    switch (method) {
      case 'CASH':
        return (
          <span
            className={`inline-flex items-center gap-1 ${
              isCompact ? 'px-1.5 py-0.2 text-[10px]' : 'px-2.5 py-1 text-xs'
            } rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold shrink-0`}
          >
            <Banknote className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            <span>Tunai</span>
          </span>
        );
      case 'QRIS':
        return (
          <span
            className={`inline-flex items-center gap-1 ${
              isCompact ? 'px-1.5 py-0.2 text-[10px]' : 'px-2.5 py-1 text-xs'
            } rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold shrink-0`}
          >
            <QrCode className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            <span>QRIS</span>
          </span>
        );
      case 'CUSTOMER_DEBT':
      case 'DEBT':
        return (
          <span
            className={`inline-flex items-center gap-1 ${
              isCompact ? 'px-1.5 py-0.2 text-[10px]' : 'px-2.5 py-1 text-xs'
            } rounded-full bg-amber-50 text-amber-900 border border-amber-300 font-bold shrink-0`}
          >
            <BookOpen className={isCompact ? 'w-2.5 h-2.5 text-amber-700' : 'w-3 h-3 text-amber-700'} />
            <span>Kasbon</span>
          </span>
        );
      case 'BANK_TRANSFER':
      case 'TRANSFER':
        return (
          <span
            className={`inline-flex items-center gap-1 ${
              isCompact ? 'px-1.5 py-0.2 text-[10px]' : 'px-2.5 py-1 text-xs'
            } rounded-full bg-sky-50 text-sky-800 border border-sky-200 font-bold shrink-0`}
          >
            <Building2 className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            <span>Transfer</span>
          </span>
        );
      case 'DEBIT':
      case 'DEBIT_CARD':
      case 'CREDIT':
      case 'CREDIT_CARD':
        return (
          <span
            className={`inline-flex items-center gap-1 ${
              isCompact ? 'px-1.5 py-0.2 text-[10px]' : 'px-2.5 py-1 text-xs'
            } rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-bold shrink-0`}
          >
            <CreditCard className={isCompact ? 'w-2.5 h-2.5' : 'w-3 h-3'} />
            <span>Kartu EDC</span>
          </span>
        );
      default:
        return (
          <span
            className={`inline-flex items-center gap-1 ${
              isCompact ? 'px-1.5 py-0.2 text-[10px]' : 'px-2.5 py-1 text-xs'
            } rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-bold shrink-0`}
          >
            <span>{method || 'Lainnya'}</span>
          </span>
        );
    }
  };

  // Ringkasan metrik akurat yang merefleksikan uang masuk riil (audit-safe)
  const voidOrders = orders.filter((o) => o.orderStatus === 'VOIDED');
  const nonVoidOrders = orders.filter((o) => o.orderStatus !== 'VOIDED');
  const paidOrders = nonVoidOrders.filter((o) => o.paymentStatus !== 'UNPAID');
  const unpaidOrders = nonVoidOrders.filter((o) => o.paymentStatus === 'UNPAID');

  // Faktur Lunas (Masuk Uang): Hanya faktur yang benar-benar dibayar dan bukan VOID
  const totalFakturLunas = paidOrders.length;
  // Total Omset Kasir: Akumulasi penerimaan riil (hanya transaksi yang sudah lunas dan bukan VOID)
  const totalOmset = paidOrders.reduce((sum, o) => sum + Number(o.grandTotal || o.totalAmount || 0), 0);

  // Transaksi Tunai: pesanan lunas dengan pembayaran CASH
  const cashTransaksi = paidOrders.filter((o) =>
    o.payments?.some((p) => (p.method || (p as any).paymentMethod || '').toUpperCase() === 'CASH')
  ).length;

  // Transaksi QRIS: pesanan lunas dengan pembayaran QRIS
  const qrisTransaksi = paidOrders.filter((o) =>
    o.payments?.some((p) => (p.method || (p as any).paymentMethod || '').toUpperCase() === 'QRIS')
  ).length;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Stats Cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-blue-950 flex items-center gap-2.5">
            <Receipt className="w-6 h-6 text-blue-900" />
            <span>Riwayat Transaksi Penjualan</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Daftar faktur transaksi penjualan kasir, pembayaran, ekspor laporan, dan cetak struk.
          </p>
        </div>

        {/* Action Buttons: Ekspor Excel, Cetak Rekap PDF, Segarkan Data */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          <button
            type="button"
            onClick={() => exportOrdersToCsv(orders)}
            disabled={loading || orders.length === 0}
            className="px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-40 active:scale-95"
            title="Ekspor Riwayat Transaksi ke Excel / CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Ekspor Excel</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const outletName = orders[0]?.outlet?.name || 'Well POS';
              generateSalesRecapPdf(orders, selectedChannel, outletName);
            }}
            disabled={loading || orders.length === 0}
            className="px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-40 active:scale-95"
            title="Cetak Dokumen Rekap Penjualan Kasir (PDF)"
          >
            <FileText className="w-4 h-4 text-blue-900" />
            <span>Cetak Rekap PDF</span>
          </button>

          <button
            type="button"
            onClick={() => loadOrders()}
            disabled={loading}
            className="px-3.5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 active:scale-95"
          >
            <RefreshCw className={`w-4 h-4 text-blue-900 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Faktur Lunas (Uang Masuk) */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Faktur Lunas (Masuk Uang)</span>
            {voidOrders.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-extrabold">
                {voidOrders.length} Void
              </span>
            )}
          </div>
          <div className="text-2xl font-black text-blue-950">{totalFakturLunas} Faktur</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {voidOrders.length > 0 || unpaidOrders.length > 0 ? (
              <span>
                Dari {orders.length} nota ({voidOrders.length > 0 ? `${voidOrders.length} Void` : ''}
                {voidOrders.length > 0 && unpaidOrders.length > 0 ? ', ' : ''}
                {unpaidOrders.length > 0 ? `${unpaidOrders.length} Belum Bayar` : ''})
              </span>
            ) : (
              <span>100% penerimaan kas riil</span>
            )}
          </div>
        </div>

        {/* Card 2: Total Omset Kasir */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
            Total Omset Kasir
          </div>
          <div className="text-2xl font-black text-blue-900">
            Rp {totalOmset.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Akumulasi penerimaan riil</div>
        </div>

        {/* Card 3: Tunai (Cash) */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tunai (Cash)</span>
          </div>
          <div className="text-2xl font-black text-emerald-700">{cashTransaksi} Transaksi</div>
          <div className="text-[11px] text-slate-500 mt-1">Uang fisik laci kasir</div>
        </div>

        {/* Card 4: QRIS Non-Tunai */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5 text-indigo-600" />
            <span>QRIS Non-Tunai</span>
          </div>
          <div className="text-2xl font-black text-indigo-700">{qrisTransaksi} Transaksi</div>
          <div className="text-[11px] text-slate-500 mt-1">Settlement digital QR</div>
        </div>
      </div>

      {/* Filter Bar (Search + Channel Dropdown) */}
      <div className="flex flex-col sm:flex-row gap-2">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor invoice (INV/...) atau nama pelanggan..."
              className="w-full bg-white border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm font-medium transition-all outline-none"
            />
          </div>
          <button
            type="submit"
            className="px-5 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm shrink-0"
          >
            Cari
          </button>
        </form>

        {/* Dropdown Filter Saluran Pesanan */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 shrink-0 shadow-2xs">
          <Filter className="w-4 h-4 text-blue-900 shrink-0" />
          <span className="text-xs font-bold text-slate-600">Saluran:</span>
          <select
            value={selectedChannel}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedChannel(val);
              loadOrders(val);
            }}
            className="bg-transparent text-xs font-bold text-blue-950 outline-none cursor-pointer pr-1"
          >
            <option value="ALL">Semua Saluran</option>
            {channelOptions.map((ch) => (
              <option key={ch.code} value={ch.code}>
                {getChannelEmoji(ch.code)} {ch.name}
              </option>
            ))}
          </select>
        </div>

        {/* Dropdown Filter Periode / Tanggal */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowDateDrop((v) => !v)}
            className="flex items-center gap-2 bg-white border border-slate-200 hover:border-blue-900/30 rounded-xl px-3 py-2 shrink-0 shadow-2xs text-xs font-bold text-slate-700 transition-all cursor-pointer h-full"
          >
            <Calendar className="w-4 h-4 text-blue-900 shrink-0" />
            <span>{datePreset !== 'custom' ? PRESET_LABELS[datePreset] : `${customStart} s/d ${customEnd}`}</span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showDateDrop && (
            <div className="absolute right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 min-w-[210px] p-2 animate-in fade-in zoom-in-95">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2.5 py-1 mb-1">
                Pilih Periode Transaksi
              </div>
              {(['today', '7days', '30days', 'thismonth', 'all', 'custom'] as DatePreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setDatePreset(p);
                    if (p !== 'custom') {
                      setShowDateDrop(false);
                      loadOrders(selectedChannel, p);
                    }
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold transition-all ${
                    datePreset === p
                      ? 'bg-blue-50 text-blue-900'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  {PRESET_LABELS[p]}
                </button>
              ))}

              {datePreset === 'custom' && (
                <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-2 p-1">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Dari Tanggal:</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-200 rounded-lg p-1.5 outline-none focus:border-blue-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Sampai Tanggal:</label>
                    <input
                      type="date"
                      value={customEnd}
                      onChange={(e) => setCustomEnd(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-200 rounded-lg p-1.5 outline-none focus:border-blue-900"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDateDrop(false);
                      loadOrders(selectedChannel, 'custom', customStart, customEnd);
                    }}
                    className="w-full mt-1 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                  >
                    Terapkan Rentang
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">No. Faktur</th>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Kasir</th>
                    <th className="py-3 px-4">Saluran</th>
                    <th className="py-3 px-4">Pelanggan</th>
                    <th className="py-3 px-4">Metode Bayar</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4 text-right">Total Bayar</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <TableSkeleton rows={5} columns={9} actionCol />
                </tbody>
              </table>
            </div>
            <div className="md:hidden divide-y divide-slate-100 p-4 space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse space-y-2 p-3 bg-slate-50 rounded-xl">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                  <div className="h-4 bg-slate-200 rounded w-1/4" />
                </div>
              ))}
            </div>
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-7 h-7 text-blue-900" />}
            title="Belum Ada Riwayat Transaksi"
            description="Seluruh transaksi penjualan yang diproses melalui Mesin Kasir POS akan otomatis tercatat dan muncul di sini."
          />
        ) : (
          <>
            {/* Desktop Table View (Hidden on Mobile) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">No. Faktur</th>
                    <th className="py-3 px-4">Waktu</th>
                    <th className="py-3 px-4">Kasir</th>
                    <th className="py-3 px-4">Saluran</th>
                    <th className="py-3 px-4">Pelanggan</th>
                    <th className="py-3 px-4">Metode Bayar</th>
                    <th className="py-3 px-4 text-right">Subtotal</th>
                    <th className="py-3 px-4 text-right">Total Bayar</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedOrders.map((order) => {
                    const chKey = (order.channel || 'DINE_IN') as OrderChannel;
                    const chInfo = ORDER_CHANNEL_LABELS[chKey] || {
                      label: order.channel || 'Dine In',
                      color: '#1e3a8a',
                      bg: '#dbeafe',
                    };

                    return (
                      <tr key={order.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={order.orderStatus === 'VOIDED' ? 'text-slate-400 line-through' : 'text-blue-950'}>
                              {order.invoiceNumber}
                            </span>
                            {order.orderStatus === 'VOIDED' && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                                VOID
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 text-xs">
                          {new Date(order.createdAt).toLocaleString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-700 text-xs">
                          <div className="flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-blue-900 shrink-0" />
                            <span className="truncate max-w-[130px]" title={order.cashier?.name || order.user?.name || 'Kasir'}>
                              {order.cashier?.name || order.user?.name || 'Kasir'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-extrabold"
                            style={{ color: chInfo.color, backgroundColor: chInfo.bg }}
                          >
                            {chInfo.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800">
                          {order.customerName ? (
                            <span className="flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <span>{order.customerName}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs italic">Umum / Tunai</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {renderPaymentMethodBadge(order, false)}
                        </td>
                        <td className="py-3.5 px-4 text-right text-slate-600">
                          Rp {Number(order.subtotal).toLocaleString('id-ID')}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {order.orderStatus === 'VOIDED' ? (
                            <div>
                              <span className="font-bold text-slate-400 line-through text-xs">
                                Rp {Number(order.grandTotal).toLocaleString('id-ID')}
                              </span>
                              <div className="text-[10px] text-rose-600 font-extrabold uppercase">
                                Dibatalkan
                              </div>
                            </div>
                          ) : (
                            <span className="font-black text-blue-950">
                              Rp {Number(order.grandTotal).toLocaleString('id-ID')}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Tombol Detail Transaksi */}
                            <button
                              type="button"
                              onClick={() => handleViewDetail(order)}
                              className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl transition-all shadow-2xs inline-flex items-center justify-center active:scale-95 cursor-pointer"
                              title="Lihat Rincian Lengkap Transaksi"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Tombol Cetak / Lihat Struk */}
                            <button
                              type="button"
                              onClick={() => handleViewReceipt(order)}
                              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl transition-all shadow-2xs inline-flex items-center justify-center active:scale-95 cursor-pointer"
                              title="Cetak / Pratinjau Struk Termal"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            {order.orderStatus === 'VOIDED' ? (
                              <span className="px-2 py-1 text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 rounded-lg">
                                VOIDED
                              </span>
                            ) : (
                              <>
                                {/* Tombol + Susulan: HANYA DINE_IN & BELUM BAYAR (UNPAID) */}
                                {onAppendOrder && order.channel === 'DINE_IN' && order.paymentStatus === 'UNPAID' && (
                                  <button
                                    type="button"
                                    onClick={() => onAppendOrder(order)}
                                    className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl transition-all shadow-2xs inline-flex items-center justify-center active:scale-95 cursor-pointer"
                                    title="Tambah Pesanan Susulan (Khusus Meja Belum Bayar)"
                                  >
                                    <UtensilsCrossed className="w-4 h-4 text-amber-700" />
                                  </button>
                                )}

                                {/* Tombol Void: BUKAN VOID */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOrderToVoid(order);
                                    setVoidModalOpen(true);
                                  }}
                                  className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl transition-all shadow-2xs inline-flex items-center justify-center active:scale-95 cursor-pointer"
                                  title="Batalkan Transaksi (Approval Supervisor/Owner)"
                                >
                                  <Ban className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Card List View (Visible on Smartphone 6.8") */}
            <div className="block md:hidden divide-y divide-slate-100">
              {paginatedOrders.map((order) => {
                const chKey = (order.channel || 'DINE_IN') as OrderChannel;
                const chInfo = ORDER_CHANNEL_LABELS[chKey] || {
                  label: order.channel || 'Dine In',
                  color: '#1e3a8a',
                  bg: '#dbeafe',
                };

                return (
                  <div key={order.id} className="p-3.5 space-y-2 hover:bg-slate-50/70 transition-colors">
                    {/* Top Row: Invoice + Time + Channel Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`font-mono font-black text-xs truncate ${order.orderStatus === 'VOIDED' ? 'text-slate-400 line-through' : 'text-blue-950'}`}>
                          {order.invoiceNumber}
                        </span>
                        {order.orderStatus === 'VOIDED' && (
                          <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                            VOID
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 font-medium shrink-0">
                          {new Date(order.createdAt).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black shrink-0"
                        style={{ color: chInfo.color, backgroundColor: chInfo.bg }}
                      >
                        {chInfo.label}
                      </span>
                    </div>

                    {/* Middle Row: Customer + Payment Method + Total */}
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-600 truncate">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold truncate">
                          {order.customerName || 'Umum (Walk-in)'}
                        </span>
                        <span className="text-slate-300">•</span>
                        {renderPaymentMethodBadge(order, true)}
                      </div>

                      <div className="text-right shrink-0">
                        {order.orderStatus === 'VOIDED' ? (
                          <div>
                            <span className="font-bold text-xs text-slate-400 line-through">
                              Rp {Number(order.grandTotal).toLocaleString('id-ID')}
                            </span>
                            <div className="text-[9px] text-rose-600 font-bold uppercase">
                              Dibatalkan
                            </div>
                          </div>
                        ) : (
                          <span className="font-black text-sm text-blue-950">
                            Rp {Number(order.grandTotal).toLocaleString('id-ID')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Kasir Sub-Row */}
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100/80">
                      <div className="flex items-center gap-1 truncate">
                        <UserCheck className="w-3 h-3 text-blue-900 shrink-0" />
                        <span className="truncate">
                          Kasir: <strong className="text-slate-800 font-bold">{order.cashier?.name || order.user?.name || 'Kasir'}</strong>
                        </span>
                      </div>
                      <div className="text-slate-400 font-mono text-[10px]">
                        Sub: Rp {Number(order.subtotal).toLocaleString('id-ID')}
                      </div>
                    </div>

                    {/* Bottom Actions Row */}
                    <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-100/80">
                      {/* Tombol Detail Transaksi */}
                      <button
                        type="button"
                        onClick={() => handleViewDetail(order)}
                        className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl transition-all shadow-2xs inline-flex items-center justify-center active:scale-95 cursor-pointer"
                        title="Lihat Rincian Lengkap Transaksi"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Tombol Cetak / Lihat Struk */}
                      <button
                        type="button"
                        onClick={() => handleViewReceipt(order)}
                        className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl transition-all shadow-2xs inline-flex items-center justify-center active:scale-95 cursor-pointer"
                        title="Cetak / Pratinjau Struk Termal"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      {order.orderStatus === 'VOIDED' ? (
                        <span className="px-2 py-1 text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200 rounded-lg">
                          VOIDED
                        </span>
                      ) : (
                        <>
                          {/* Tombol + Susulan: HANYA DINE_IN & BELUM BAYAR (UNPAID) */}
                          {onAppendOrder && order.channel === 'DINE_IN' && order.paymentStatus === 'UNPAID' && (
                            <button
                              type="button"
                              onClick={() => onAppendOrder(order)}
                              className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl transition-all shadow-2xs inline-flex items-center justify-center active:scale-95 cursor-pointer"
                              title="Tambah Pesanan Susulan (Khusus Meja Belum Bayar)"
                            >
                              <UtensilsCrossed className="w-4 h-4 text-amber-700" />
                            </button>
                          )}

                          {/* Tombol Void: BUKAN VOID */}
                          <button
                            type="button"
                            onClick={() => {
                              setOrderToVoid(order);
                              setVoidModalOpen(true);
                            }}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl transition-all shadow-2xs inline-flex items-center justify-center active:scale-95 cursor-pointer"
                            title="Batalkan Transaksi (Approval Supervisor/Owner)"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Pagination Riwayat Transaksi */}
        {!loading && orders.length > 0 && (
          <TablePagination
            currentPage={safeCurrentPage}
            pageSize={pageSize}
            totalItems={orders.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="transaksi"
          />
        )}
      </div>

      {/* Toast Alert Sukses */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 p-4 bg-emerald-900 text-white rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="p-1 hover:bg-white/20 rounded-lg text-emerald-200 hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Modal Preview Struk */}
      <OrderSuccessModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        order={selectedOrder}
      />

      {/* Modal Rincian Lengkap Transaksi */}
      <OrderDetailModal
        isOpen={detailModalOpen}
        onClose={() => {
          setDetailModalOpen(false);
          setOrderForDetail(null);
        }}
        order={orderForDetail}
        onViewReceipt={(ord) => {
          setDetailModalOpen(false);
          handleViewReceipt(ord);
        }}
        onAppendOrder={
          onAppendOrder
            ? (ord) => {
                setDetailModalOpen(false);
                onAppendOrder(ord);
              }
            : undefined
        }
        onVoidOrder={(ord) => {
          setDetailModalOpen(false);
          setOrderToVoid(ord);
          setVoidModalOpen(true);
        }}
        onVoidItem={(ord, itm) => {
          setDetailModalOpen(false);
          setOrderToVoid(ord);
          setItemToVoid(itm);
          setVoidItemModalOpen(true);
        }}
      />

      {/* Modal Void Transaksi Penuh */}
      <VoidOrderModal
        isOpen={voidModalOpen}
        onClose={() => {
          setVoidModalOpen(false);
          setOrderToVoid(null);
        }}
        order={orderToVoid}
        onSuccess={(_orderId, invoiceNumber) => {
          setToastMsg(`Transaksi ${invoiceNumber} berhasil dibatalkan (VOID)`);
          setTimeout(() => setToastMsg(null), 5000);
          loadOrders();
        }}
      />

      {/* Modal Void Parsial Item Pesanan */}
      <VoidOrderItemModal
        isOpen={voidItemModalOpen}
        onClose={() => {
          setVoidItemModalOpen(false);
          setOrderToVoid(null);
          setItemToVoid(null);
        }}
        order={orderToVoid}
        orderItem={itemToVoid}
        onSuccess={(_orderId, invoiceNumber, itemName) => {
          setToastMsg(`Item "${itemName}" pada faktur ${invoiceNumber} berhasil dibatalkan (VOID)`);
          setTimeout(() => setToastMsg(null), 5000);
          loadOrders();
        }}
      />
    </div>
  );
};
