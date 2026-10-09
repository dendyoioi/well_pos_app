import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Receipt,
  Search,
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
  Package,
  MessageCircle,
  Copy,
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
import { PaymentItemsAuditView } from './PaymentItemsAuditView';
import { api, authStorage } from '../services/api';

import type { User as AuthUser } from '../types/auth';

interface OrdersViewProps {
  activeOutlet?: Outlet | null;
  currentUser?: AuthUser | null;
  onAppendOrder?: (order: Order) => void;
  initialSubTab?: 'invoices' | 'payment_items';
}

type DatePreset = 'all' | 'current_shift' | 'today' | '7days' | '30days' | 'thismonth' | 'custom';
const PRESET_LABELS: Record<DatePreset, string> = {
  all: 'Semua Periode',
  current_shift: '🕒 Shift Berjalan (Saat Ini)',
  today: 'Hari Ini',
  '7days': '7 Hari Terakhir',
  '30days': '30 Hari Terakhir',
  thismonth: 'Bulan Ini',
  custom: 'Kustom Tanggal',
};

type OrderStatusFilter = 'ALL' | 'PAID' | 'VOIDED' | 'UNPAID';

import { toLocalDateStr, computePresetDateRange } from '../utils/date';

function getPresetRange(preset: DatePreset): { start?: string; end?: string } {
  if (preset === 'all' || preset === 'current_shift') return {};
  const { startStr, endStr } = computePresetDateRange(preset as any);
  return { start: startStr, end: endStr };
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  activeOutlet,
  currentUser: propUser,
  onAppendOrder,
  initialSubTab,
}) => {
  const currentUser = useMemo(() => propUser || authStorage.getUser(), [propUser]);
  const isCashierRole = currentUser?.role === 'CASHIER';

  const [activeSubTab, setActiveSubTab] = useState<'invoices' | 'payment_items'>(
    initialSubTab || 'invoices'
  );
  const [selectedCashier, setSelectedCashier] = useState<string>(() => {
    const user = propUser || authStorage.getUser();
    return user?.role === 'CASHIER' && user?.name ? user.name : 'ALL';
  });
  const [selectedStatus, setSelectedStatus] = useState<OrderStatusFilter>('ALL');
  const [currentShift, setCurrentShift] = useState<any | null>(null);

  const paymentItemsExportRef = useRef<{ exportCsv: () => void; exportPdf: () => void } | null>(null);

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    api.getCurrentShift()
      .then((res) => {
        if (res && res.status === 'success' && res.data) {
          setCurrentShift(res.data);
        } else {
          setCurrentShift(null);
        }
      })
      .catch(() => setCurrentShift(null));
  }, [activeOutlet?.id]);

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
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [copiedWaText, setCopiedWaText] = useState(false);
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
      if (currentPreset === 'current_shift') {
        if (currentShift?.startTime) {
          sDate = toLocalDateStr(new Date(currentShift.startTime));
          eDate = toLocalDateStr(new Date());
        } else {
          sDate = toLocalDateStr(new Date());
          eDate = toLocalDateStr(new Date());
        }
      } else if (currentPreset === 'custom') {
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

  const [registeredCashiers, setRegisteredCashiers] = useState<string[]>([]);

  useEffect(() => {
    const tenantId = currentUser?.tenantId || (activeOutlet as any)?.tenantId;
    if (tenantId && activeOutlet?.id) {
      api
        .getPairedOutletCashiers(tenantId, activeOutlet.id)
        .then((res) => {
          if (res.status === 'success' && Array.isArray(res.data)) {
            // HANYA ambil staf dengan peran KASIR (role === 'CASHIER') di outlet aktif
            const cashierNames = res.data
              .filter((u) => u.role === 'CASHIER')
              .map((u) => u.name.trim());
            setRegisteredCashiers(cashierNames);
          }
        })
        .catch((err) => console.error('Gagal memuat kasir outlet:', err));
    }
  }, [activeOutlet?.id, currentUser?.tenantId]);

  const cashierOptions = useMemo(() => {
    const set = new Set<string>();

    // 1. Masukkan staf kasir resmi terdaftar di outlet aktif (role === 'CASHIER')
    registeredCashiers.forEach((name) => {
      if (name) set.add(name);
    });

    // 2. Jika user yang login adalah kasir, pastikan namanya selalu ada
    if (isCashierRole && currentUser?.name) {
      set.add(currentUser.name.trim());
    }

    // 3. Masukkan dari order jika user ber-role CASHIER (dan eliminasi tag non-kasir)
    orders.forEach((o) => {
      const cRole = (o.cashier as any)?.role || (o as any).user?.role;
      // Lewati jika role non-kasir (OWNER, ADMIN, SUPERVISOR, WAREHOUSE)
      if (cRole && cRole !== 'CASHIER') return;

      const name = o.cashier?.name || (o as any).user?.name;
      if (!name || !name.trim()) return;

      const lower = name.toLowerCase();
      if (
        lower.includes('(owner)') ||
        lower.includes('(admin)') ||
        lower.includes('(supervisor)') ||
        lower.includes('(gudang)')
      ) {
        return;
      }
      set.add(name.trim());
    });

    return Array.from(set).sort();
  }, [registeredCashiers, orders, isCashierRole, currentUser?.name]);

  // 1. Filter Kasir
  const cashierFilteredOrders = useMemo(() => {
    if (selectedCashier === 'ALL') return orders;
    return orders.filter(
      (o) => (o.cashier?.name || (o as any).user?.name) === selectedCashier
    );
  }, [orders, selectedCashier]);

  // 2. Filter Shift Berjalan (jika preset active)
  const shiftFilteredOrders = useMemo(() => {
    if (datePreset === 'current_shift' && currentShift) {
      return cashierFilteredOrders.filter((o) => {
        if (o.shiftId && currentShift.id) {
          return o.shiftId === currentShift.id;
        }
        return new Date(o.createdAt) >= new Date(currentShift.startTime);
      });
    }
    return cashierFilteredOrders;
  }, [cashierFilteredOrders, datePreset, currentShift]);

  // 3. Hitung Jumlah Status untuk Pill Filter
  const statusCounts = useMemo(() => {
    const voidCount = shiftFilteredOrders.filter(
      (o) => o.orderStatus === 'VOIDED' || o.status === 'CANCELLED'
    ).length;
    const nonVoid = shiftFilteredOrders.filter(
      (o) => o.orderStatus !== 'VOIDED' && o.status !== 'CANCELLED'
    );
    const paidCount = nonVoid.filter((o) => o.paymentStatus !== 'UNPAID').length;
    const unpaidCount = nonVoid.filter((o) => o.paymentStatus === 'UNPAID').length;
    return {
      all: shiftFilteredOrders.length,
      paid: paidCount,
      voided: voidCount,
      unpaid: unpaidCount,
    };
  }, [shiftFilteredOrders]);

  // 4. Filter Akhir berdasarkan Status Faktur yang dipilih
  const filteredOrders = useMemo(() => {
    if (selectedStatus === 'ALL') return shiftFilteredOrders;
    if (selectedStatus === 'PAID') {
      return shiftFilteredOrders.filter(
        (o) => o.orderStatus !== 'VOIDED' && o.status !== 'CANCELLED' && o.paymentStatus !== 'UNPAID'
      );
    }
    if (selectedStatus === 'VOIDED') {
      return shiftFilteredOrders.filter(
        (o) => o.orderStatus === 'VOIDED' || o.status === 'CANCELLED'
      );
    }
    if (selectedStatus === 'UNPAID') {
      return shiftFilteredOrders.filter(
        (o) => o.paymentStatus === 'UNPAID' && o.orderStatus !== 'VOIDED' && o.status !== 'CANCELLED'
      );
    }
    return shiftFilteredOrders;
  }, [shiftFilteredOrders, selectedStatus]);

  const dateRangeText = useMemo(() => {
    if (datePreset === 'current_shift') return currentShift ? 'Shift Berjalan (Saat Ini)' : 'Shift Berjalan';
    if (datePreset === 'today') return 'Hari Ini';
    if (datePreset === '7days') return '7 Hari Terakhir';
    if (datePreset === '30days') return '30 Hari Terakhir';
    if (datePreset === 'thismonth') return 'Bulan Ini';
    if (datePreset === 'custom') return `${customStart} s/d ${customEnd}`;
    return 'Semua Periode';
  }, [datePreset, currentShift, customStart, customEnd]);

  // Reset pagination ke halaman 1 saat filter atau pencarian berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedChannel, selectedCashier, selectedStatus, datePreset, customStart, customEnd]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedOrders = filteredOrders.slice(
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
  const voidOrders = shiftFilteredOrders.filter((o) => o.orderStatus === 'VOIDED' || o.status === 'CANCELLED');
  const nonVoidOrders = shiftFilteredOrders.filter((o) => o.orderStatus !== 'VOIDED' && o.status !== 'CANCELLED');
  const paidOrders = nonVoidOrders.filter((o) => o.paymentStatus !== 'UNPAID');
  const unpaidOrders = nonVoidOrders.filter((o) => o.paymentStatus === 'UNPAID');

  // Faktur Lunas (Masuk Uang): Hanya faktur yang benar-benar dibayar dan bukan VOID
  const totalFakturLunas = paidOrders.length;
  // Total Omset Kasir: Akumulasi penerimaan riil (hanya transaksi yang sudah lunas dan bukan VOID)
  const totalOmset = paidOrders.reduce((sum, o) => sum + Number(o.grandTotal || o.totalAmount || 0), 0);
  // Average Order Value (AOV / Nilai Rata-rata per Nota)
  const averageOrderValue = totalFakturLunas > 0 ? Math.round(totalOmset / totalFakturLunas) : 0;

  // Transaksi Tunai: pesanan lunas dengan pembayaran CASH
  const cashOrders = paidOrders.filter((o) =>
    o.payments?.some((p) => (p.method || (p as any).paymentMethod || '').toUpperCase() === 'CASH')
  );
  const cashTransaksi = cashOrders.length;
  const cashTotalAmount = cashOrders.reduce((sum, o) => {
    const cashPm = o.payments?.filter((p) => (p.method || (p as any).paymentMethod || '').toUpperCase() === 'CASH');
    const amt = cashPm?.reduce((s, p) => s + Number(p.amount || p.amountPaid || 0), 0) || 0;
    return sum + (amt > 0 ? amt : Number(o.grandTotal || o.totalAmount || 0));
  }, 0);

  // Transaksi Non-Tunai: pesanan lunas dengan pembayaran selain CASH (QRIS, Transfer, EDC, dll)
  const nonCashOrders = paidOrders.filter((o) =>
    o.payments?.some((p) => (p.method || (p as any).paymentMethod || '').toUpperCase() !== 'CASH')
  );
  const nonCashTransaksi = nonCashOrders.length;
  const nonCashTotalAmount = nonCashOrders.reduce((sum, o) => {
    const nonCashPm = o.payments?.filter((p) => (p.method || (p as any).paymentMethod || '').toUpperCase() !== 'CASH');
    const amt = nonCashPm?.reduce((s, p) => s + Number(p.amount || p.amountPaid || 0), 0) || 0;
    return sum + (amt > 0 ? amt : Number(o.grandTotal || o.totalAmount || 0));
  }, 0);

  // Generator Teks Ringkasan Penjualan Format WhatsApp
  const generateWhatsAppSummaryText = () => {
    const outletName = filteredOrders[0]?.outlet?.name || activeOutlet?.name || 'Well POS';
    const cashierLabel = selectedCashier && selectedCashier !== 'ALL' ? selectedCashier : 'Semua Kasir';
    const nowStr = new Date().toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    const voidTotal = voidOrders.reduce((s, o) => s + Number(o.grandTotal || o.totalAmount || 0), 0);
    const unpaidTotal = unpaidOrders.reduce((s, o) => s + Number(o.grandTotal || o.totalAmount || 0), 0);

    return `*📊 RINGKASAN PENJUALAN — WELL POS*
━━━━━━━━━━━━━━━━━━
🏪 *Outlet*: ${outletName}
📅 *Periode*: ${dateRangeText}
👤 *Kasir*: ${cashierLabel}
🕒 *Waktu Cetak*: ${nowStr}
━━━━━━━━━━━━━━━━━━
💰 *FINANSIAL PENJUALAN*
• Total Omset Lunas : *Rp ${totalOmset.toLocaleString('id-ID')}*
• Rata-rata per Nota (AOV) : *Rp ${averageOrderValue.toLocaleString('id-ID')}*
• Faktur Selesai : *${totalFakturLunas} transaksi*

💳 *METODE PEMBAYARAN*
• Tunai (Cash) : *Rp ${cashTotalAmount.toLocaleString('id-ID')}* (${cashTransaksi} tx)
• Non-Tunai / QRIS : *Rp ${nonCashTotalAmount.toLocaleString('id-ID')}* (${nonCashTransaksi} tx)

⚠️ *STATUS OPERASIONAL*
• Dibatalkan (Void) : *${voidOrders.length} transaksi* (Rp ${voidTotal.toLocaleString('id-ID')})
• Tagihan Belum Bayar : *${unpaidOrders.length} transaksi* (Rp ${unpaidTotal.toLocaleString('id-ID')})
━━━━━━━━━━━━━━━━━━
_Laporan otomatis dibuat dari Backoffice Well POS_`;
  };

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
            Daftar faktur transaksi penjualan kasir, pembayaran, ekspor laporan, dan rekap item menu.
          </p>
        </div>

        {/* Action Buttons: Ringkasan WA, Ekspor Excel, Cetak Rekap PDF */}
        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
          {/* Tombol Ringkasan WhatsApp */}
          <button
            type="button"
            onClick={() => setWhatsappModalOpen(true)}
            disabled={loading || shiftFilteredOrders.length === 0}
            className="h-10 px-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-40 active:scale-95 cursor-pointer"
            title="Kirim atau Salin Ringkasan Penjualan ke WhatsApp"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Ringkasan WA</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (activeSubTab === 'invoices') {
                exportOrdersToCsv(filteredOrders, 'daftar_faktur_penjualan_wellpos');
              } else {
                paymentItemsExportRef.current?.exportCsv();
              }
            }}
            disabled={loading || (activeSubTab === 'invoices' ? filteredOrders.length === 0 : false)}
            className="h-10 px-3.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-40 active:scale-95 cursor-pointer"
            title={
              activeSubTab === 'invoices'
                ? 'Ekspor Daftar Faktur Penjualan ke Excel / CSV'
                : 'Ekspor Rekap Item Menu Terjual ke Excel / CSV'
            }
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {activeSubTab === 'invoices' ? 'Ekspor Faktur (Excel)' : 'Ekspor Rekap Item (Excel)'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (activeSubTab === 'invoices') {
                const outletName = filteredOrders[0]?.outlet?.name || activeOutlet?.name || 'Well POS';
                generateSalesRecapPdf(filteredOrders, selectedChannel, outletName);
              } else {
                paymentItemsExportRef.current?.exportPdf();
              }
            }}
            disabled={loading || (activeSubTab === 'invoices' ? filteredOrders.length === 0 : false)}
            className="h-10 px-3.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 disabled:opacity-40 active:scale-95 cursor-pointer"
            title={
              activeSubTab === 'invoices'
                ? 'Cetak Dokumen Daftar Faktur Penjualan (PDF)'
                : 'Cetak Dokumen Rekapitulasi Item Menu Terjual (PDF)'
            }
          >
            <FileText className="w-4 h-4 text-blue-900 shrink-0" />
            <span>
              {activeSubTab === 'invoices' ? 'Cetak Faktur (PDF)' : 'Cetak Rekap Item (PDF)'}
            </span>
          </button>
        </div>
      </div>

      {/* Sub-Tab Navigation Switcher */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('invoices')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'invoices'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>Daftar Faktur Penjualan</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeSubTab === 'invoices' ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {filteredOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('payment_items')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'payment_items'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Rekap Item per Pembayaran</span>
        </button>
      </div>

      {/* Global Toolbar Filters (Saluran, Kasir, Rentang Tanggal) - Bersama untuk Kedua Sub-Tab */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 bg-slate-50/80 p-2.5 rounded-2xl border border-slate-200">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto min-w-0">
          {/* Dropdown Filter Saluran Pesanan */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-10 w-full sm:w-auto max-w-full min-w-0 shadow-2xs">
            <Filter className="w-4 h-4 text-blue-900 shrink-0" />
            <span className="text-xs font-bold text-slate-600 shrink-0">Saluran:</span>
            <select
              value={selectedChannel}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedChannel(val);
                loadOrders(val);
              }}
              className="bg-transparent text-xs font-bold text-blue-950 outline-none cursor-pointer pr-1 min-w-0 flex-1 sm:flex-initial truncate"
            >
              <option value="ALL">Semua Saluran</option>
              {channelOptions.map((ch) => (
                <option key={ch.code} value={ch.code}>
                  {getChannelEmoji(ch.code)} {ch.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter Kasir: Smart Default untuk Kasir (Akun Saya) atau Pilihan Semua Kasir di Toko Ini */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-10 w-full sm:w-auto max-w-full min-w-0 shadow-2xs">
            <UserCheck className="w-4 h-4 text-blue-900 shrink-0" />
            <span className="text-xs font-bold text-slate-600 shrink-0">Kasir:</span>
            <select
              value={selectedCashier}
              onChange={(e) => {
                setSelectedCashier(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs font-bold text-blue-950 outline-none cursor-pointer pr-1 min-w-0 flex-1 truncate"
            >
              <option value="ALL">👤 Semua Kasir di Toko Ini</option>
              {cashierOptions.map((name) => {
                const isMe = isCashierRole && currentUser?.name === name;
                return (
                  <option key={name} value={name}>
                    👤 {name} {isMe ? '(Akun Saya)' : ''}
                  </option>
                );
              })}
            </select>
            {isCashierRole && selectedCashier === currentUser?.name && (
              <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-black shrink-0 whitespace-nowrap ml-auto sm:ml-0">
                Akun Saya
              </span>
            )}
          </div>
        </div>

        {/* Dropdown Filter Periode / Tanggal */}
        <div className="relative w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setShowDateDrop((v) => !v)}
            className="flex items-center justify-between sm:justify-start gap-2 bg-white border border-slate-200 hover:border-blue-900/30 rounded-xl px-3 h-10 w-full sm:w-auto max-w-full shadow-2xs text-xs font-bold text-slate-700 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0 truncate">
              <Calendar className="w-4 h-4 text-blue-900 shrink-0" />
              <span className="truncate">{datePreset !== 'custom' ? PRESET_LABELS[datePreset] : `${customStart} s/d ${customEnd}`}</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>

          {showDateDrop && (
            <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 w-full sm:w-auto sm:min-w-[210px] p-2 animate-in fade-in zoom-in-95">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2.5 py-1 mb-1">
                Pilih Periode Transaksi
              </div>
              {((currentShift ? ['current_shift', 'today', '7days', '30days', 'thismonth', 'all', 'custom'] : ['today', '7days', '30days', 'thismonth', 'all', 'custom']) as DatePreset[]).map((p) => (
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
                <div className="p-2 border-t border-slate-100 mt-1 space-y-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Mulai:</label>
                    <input
                      type="date"
                      value={customStart}
                      onChange={(e) => setCustomStart(e.target.value)}
                      className="w-full text-xs font-medium border border-slate-200 rounded-lg p-1.5 outline-none focus:border-blue-900"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Sampai:</label>
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

      {/* Sub-Tab Content Switcher */}
      {activeSubTab === 'invoices' ? (
        <>
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

        {/* Card 2: Total Omset Kasir & AOV */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Total Omset Kasir</span>
            {totalFakturLunas > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200 text-[10px] font-black">
                AOV: Rp {averageOrderValue.toLocaleString('id-ID')}
              </span>
            )}
          </div>
          <div className="text-2xl font-black text-blue-900">
            Rp {totalOmset.toLocaleString('id-ID')}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Akumulasi penerimaan riil</span>
            {totalFakturLunas > 0 && (
              <span className="text-slate-400 font-semibold text-[10px]">
                Rata-rata: Rp {averageOrderValue.toLocaleString('id-ID')}/nota
              </span>
            )}
          </div>
        </div>

        {/* Card 3: Tunai (Cash) */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Banknote className="w-3.5 h-3.5 text-emerald-600" />
            <span>Tunai (Cash)</span>
          </div>
          <div className="text-2xl font-black text-emerald-700">{cashTransaksi} Transaksi</div>
          <div className="text-[11px] text-emerald-800 font-bold mt-1">
            Rp {cashTotalAmount.toLocaleString('id-ID')}
          </div>
        </div>

        {/* Card 4: Non-Tunai */}
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
            <QrCode className="w-3.5 h-3.5 text-indigo-600" />
            <span>Non-Tunai</span>
          </div>
          <div className="text-2xl font-black text-indigo-700">{nonCashTransaksi} Transaksi</div>
          <div className="text-[11px] text-indigo-800 font-bold mt-1">
            Rp {nonCashTotalAmount.toLocaleString('id-ID')}
          </div>
        </div>
      </div>

      {/* Pill Filter Status Faktur (Audit Instan: Semua, Lunas, Dibatalkan/Void, Belum Bayar) */}
      <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
        <span className="text-slate-400 font-bold text-xs shrink-0 flex items-center gap-1 mr-1">
          <Filter className="w-3.5 h-3.5" />
          <span>Status Faktur:</span>
        </span>
        <button
          type="button"
          onClick={() => setSelectedStatus('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            selectedStatus === 'ALL'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          <span>Semua Status</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              selectedStatus === 'ALL' ? 'bg-blue-800 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {statusCounts.all}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedStatus('PAID')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            selectedStatus === 'PAID'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-emerald-800 hover:bg-emerald-50'
          }`}
        >
          <span>Lunas (Masuk Uang)</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              selectedStatus === 'PAID' ? 'bg-emerald-800 text-white' : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            {statusCounts.paid}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setSelectedStatus('VOIDED')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
            selectedStatus === 'VOIDED'
              ? 'bg-rose-700 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-rose-700 hover:bg-rose-50'
          }`}
        >
          <span>Dibatalkan (Void)</span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              selectedStatus === 'VOIDED' ? 'bg-rose-800 text-white' : 'bg-rose-100 text-rose-700'
            }`}
          >
            {statusCounts.voided}
          </span>
        </button>
        {statusCounts.unpaid > 0 && (
          <button
            type="button"
            onClick={() => setSelectedStatus('UNPAID')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
              selectedStatus === 'UNPAID'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-amber-800 hover:bg-amber-50'
            }`}
          >
            <span>Belum Bayar</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
                selectedStatus === 'UNPAID' ? 'bg-amber-700 text-white' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {statusCounts.unpaid}
            </span>
          </button>
        )}
      </div>

      {/* Search Bar Khusus Faktur */}
      <div className="flex gap-2">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor invoice (INV/...) atau nama pelanggan..."
              className="w-full h-10 bg-white border border-slate-200 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 rounded-xl pl-10 pr-4 text-xs sm:text-sm font-medium transition-all outline-none"
            />
          </div>
          <button
            type="submit"
            className="h-10 px-5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm shrink-0 cursor-pointer flex items-center justify-center active:scale-95"
          >
            Cari
          </button>
        </form>
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
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            icon={<Receipt className="w-7 h-7 text-blue-900" />}
            title="Belum Ada Riwayat Transaksi"
            description={
              selectedCashier !== 'ALL'
                ? `Tidak ditemukan transaksi untuk kasir "${selectedCashier}" pada periode atau saluran yang dipilih.`
                : "Seluruh transaksi penjualan yang diproses melalui Mesin Kasir POS akan otomatis tercatat dan muncul di sini."
            }
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
                              className="w-9 h-9 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl transition-all shadow-2xs inline-flex items-center justify-center active:scale-95 cursor-pointer"
                              title="Lihat Rincian Lengkap Transaksi"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Tombol Cetak / Lihat Struk */}
                            <button
                              type="button"
                              onClick={() => handleViewReceipt(order)}
                              className="w-9 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl transition-all shadow-2xs inline-flex items-center justify-center active:scale-95 cursor-pointer"
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
                                    className="w-9 h-9 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl transition-all shadow-2xs inline-flex items-center justify-center active:scale-95 cursor-pointer"
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
                                  className="w-9 h-9 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl transition-all shadow-2xs inline-flex items-center justify-center active:scale-95 cursor-pointer"
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
                        className="w-9 h-9 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl transition-all shadow-2xs inline-flex items-center justify-center active:scale-95 cursor-pointer"
                        title="Lihat Rincian Lengkap Transaksi"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Tombol Cetak / Lihat Struk */}
                      <button
                        type="button"
                        onClick={() => handleViewReceipt(order)}
                        className="w-9 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl transition-all shadow-2xs inline-flex items-center justify-center active:scale-95 cursor-pointer"
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
                              className="w-9 h-9 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-xl transition-all shadow-2xs inline-flex items-center justify-center active:scale-95 cursor-pointer"
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
                            className="w-9 h-9 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl transition-all shadow-2xs inline-flex items-center justify-center active:scale-95 cursor-pointer"
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
        {!loading && filteredOrders.length > 0 && (
          <TablePagination
            currentPage={safeCurrentPage}
            pageSize={pageSize}
            totalItems={filteredOrders.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            pageSizeOptions={[10, 25, 50, 100]}
            itemLabel="transaksi"
          />
        )}
      </div>
        </>
      ) : (
        <div className="space-y-6">
          <PaymentItemsAuditView
            activeOutlet={activeOutlet}
            currentUser={currentUser}
            orders={filteredOrders}
            isEmbedded={true}
            selectedCashier={selectedCashier}
            dateRangeText={dateRangeText}
            exportHandlerRef={paymentItemsExportRef}
          />
        </div>
      )}

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

      {/* Modal Ringkasan Format WhatsApp */}
      {whatsappModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden border border-slate-200 animate-in slide-in-from-bottom-6 duration-300">
            {/* Header */}
            <div className="p-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-800 shrink-0">
                  <MessageCircle className="w-5 h-5 text-emerald-700" />
                </div>
                <div>
                  <h3 className="text-base font-black text-blue-950">
                    Ringkasan Penjualan WhatsApp
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Pratinjau pesan teks siap kirim ke Owner atau grup operasional
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWhatsappModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-200/60 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4">
              <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                <span>FORMAT TEKS CHAT WHATSAPP:</span>
                <span className="text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Standar Audit Well POS
                </span>
              </div>

              <div className="bg-slate-900 text-emerald-400 p-4 rounded-2xl font-mono text-xs leading-relaxed whitespace-pre-wrap border border-slate-800 shadow-inner select-all">
                {generateWhatsAppSummaryText()}
              </div>

              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-xs text-blue-950 flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-800 shrink-0 mt-0.5" />
                <span>
                  Teks di atas telah terstruktur rapi dengan format tebal (<strong>*</strong>) khas WhatsApp. Anda dapat langsung menyalinnya atau membuka aplikasi WhatsApp.
                </span>
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setWhatsappModalOpen(false)}
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold transition-all cursor-pointer"
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={() => {
                  const text = generateWhatsAppSummaryText();
                  navigator.clipboard.writeText(text);
                  setCopiedWaText(true);
                  setToastMsg('Ringkasan teks WhatsApp berhasil disalin ke clipboard!');
                  setTimeout(() => {
                    setCopiedWaText(false);
                    setToastMsg(null);
                  }, 4000);
                }}
                className="h-10 px-4 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Copy className="w-4 h-4 shrink-0" />
                <span>{copiedWaText ? '✓ Tersalin' : 'Salin Teks'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const text = generateWhatsAppSummaryText();
                  const encoded = encodeURIComponent(text);
                  window.open(`https://wa.me/?text=${encoded}`, '_blank');
                }}
                className="h-10 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <MessageCircle className="w-4 h-4 text-white shrink-0" />
                <span>Kirim via WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
