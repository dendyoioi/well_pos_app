import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  Search,
  Archive,
  ChevronRight,
  ChevronDown,
  Phone,
  Printer,
  CheckCircle2,
  AlertCircle,
  Coins,
  Send,
  Truck,
  Scale,
  Clock,
  QrCode,
  AlertOctagon,
  RotateCcw,
  ShieldAlert,
  PackageSearch,
  Tag,
  Bell,
} from 'lucide-react';
import type { Outlet } from '../types/outlet';
import { api, authStorage } from '../services/api';
import { useDialog } from '../context/DialogContext';
import type { LaundryQueueOrder, LaundryRack } from '../types/laundry';
import { LAUNDRY_11_STAGES } from '../types/laundry';
import { LaundryReceiptModal } from '../components/laundry/LaundryReceiptModal';
import { LaundryStageTrackerModal } from '../components/laundry/LaundryStageTrackerModal';
import { LaundrySortingModal } from '../components/LaundrySortingModal';
import { LaundryBarcodeScannerModal } from '../components/laundry/LaundryBarcodeScannerModal';
import { LaundryRewashModal } from '../components/laundry/LaundryRewashModal';
import { LaundryIncidentModal } from '../components/laundry/LaundryIncidentModal';
import { LaundryQcAndWeightModal } from '../components/laundry/LaundryQcAndWeightModal';
import { LaundryLostAndFoundDrawer } from '../components/laundry/LaundryLostAndFoundDrawer';
import { LaundryTagScannerModal } from '../components/laundry/LaundryTagScannerModal';
import { LaundryItemTrackingModal } from '../components/laundry/LaundryItemTrackingModal';
import { NotificationAutomationModal } from '../components/laundry/NotificationAutomationModal';

interface LaundryQueueViewProps {
  activeOutlet: Outlet | null;
}

const PIPELINE_COLUMNS = [
  { key: 'RECEIVED', label: '1. Diterima (Drop-off)', color: 'border-slate-300 bg-slate-50 text-slate-800' },
  { key: 'WASHING_DRYING', label: '2. Cuci & Kering', color: 'border-blue-300 bg-blue-50 text-blue-900' },
  { key: 'IRONING_PACKING', label: '3. Setrika & Packing', color: 'border-indigo-300 bg-indigo-50 text-indigo-900' },
  { key: 'READY_FOR_PICKUP', label: '4. Siap Ambil (Di Rak)', color: 'border-emerald-300 bg-emerald-50 text-emerald-900' },
  { key: 'COMPLETED', label: '5. Selesai (Diambil)', color: 'border-slate-200 bg-slate-100 text-slate-600' },
] as const;

export const LaundryQueueView: React.FC<LaundryQueueViewProps> = ({ activeOutlet }) => {
  const dialog = useDialog();
  const currentUser = authStorage.getUser();
  const canAccessAutomation = ['OWNER', 'ADMIN', 'SUPERVISOR'].includes(currentUser?.role || '');
  const [automationModalOpen, setAutomationModalOpen] = useState(false);

  const [orders, setOrders] = useState<LaundryQueueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [slaFilter, setSlaFilter] = useState<'ALL' | 'DUE_TODAY' | 'OVERDUE'>('ALL');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [racks, setRacks] = useState<LaundryRack[]>([]);
  const [mobileActiveStage, setMobileActiveStage] = useState<string>('RECEIVED');

  // State Modal Struk Thermal
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<LaundryQueueOrder | null>(null);

  // State Modal Penempatan Rak
  const [rackAssignModalOpen, setRackAssignModalOpen] = useState(false);
  const [targetOrderForRack, setTargetOrderForRack] = useState<LaundryQueueOrder | null>(null);
  const [chosenRackCode, setChosenRackCode] = useState('');
  const [assigningRack, setAssigningRack] = useState(false);

  // State Modal Penyerahan Cucian (Handover & Pelunasan)
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [targetOrderForHandover, setTargetOrderForHandover] = useState<LaundryQueueOrder | null>(null);
  const [handoverPayMethod, setHandoverPayMethod] = useState<'CASH' | 'QRIS' | 'TRANSFER'>('CASH');
  const [pickedUpByName, setPickedUpByName] = useState('');
  const [processingHandover, setProcessingHandover] = useState(false);

  // State Pengiriman Notifikasi WhatsApp Gateway
  const [sendingWaOrderId, setSendingWaOrderId] = useState<string | null>(null);
  const [waToast, setWaToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // State Modal Tracking 11 Tahapan Produksi & QC
  const [stageTrackerModalOpen, setStageTrackerModalOpen] = useState(false);
  const [selectedOrderForTracker, setSelectedOrderForTracker] = useState<LaundryQueueOrder | null>(null);

  // State Modal Sortir & QC Rincian Helai
  const [sortingModalOpen, setSortingModalOpen] = useState(false);
  const [selectedOrderForSorting, setSelectedOrderForSorting] = useState<LaundryQueueOrder | null>(null);

  // State Modal Klaim Garansi Cuci Ulang (Rewash Rp 0)
  const [rewashModalOpen, setRewashModalOpen] = useState(false);
  const [selectedOrderForRewash, setSelectedOrderForRewash] = useState<LaundryQueueOrder | null>(null);

  // State Modal Lapor Insiden Pakaian Rusak / Hilang
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [selectedOrderForIncident, setSelectedOrderForIncident] = useState<LaundryQueueOrder | null>(null);

  // State Modal QC Checklist & Berat Final (Core Phase 1)
  const [qcModalOpen, setQcModalOpen] = useState(false);
  const [selectedOrderForQc, setSelectedOrderForQc] = useState<LaundryQueueOrder | null>(null);

  // State Drawer Lost & Found (Core Phase 1)
  const [lostAndFoundOpen, setLostAndFoundOpen] = useState(false);

  // State Core Phase 2 (Item Tracking & Scan)
  const [tagScannerOpen, setTagScannerOpen] = useState(false);
  const [itemTrackingModalOpen, setItemTrackingModalOpen] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState<{
    id: string;
    invoiceNumber: string;
    customerName?: string;
  } | null>(null);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const res = await api.getLaundryOrders(activeOutlet?.id);
      if (res.status === 'success' && Array.isArray(res.data)) {
        setOrders(res.data);
      }
    } catch {
      // Abaikan jika offline
    } finally {
      setLoading(false);
    }
  };

  const fetchRacks = async () => {
    try {
      const rackRes = await api.getLaundryRacks(activeOutlet?.id);
      if (rackRes.status === 'success' && Array.isArray(rackRes.data)) {
        setRacks(rackRes.data);
      }
    } catch {
      // Abaikan
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchRacks();

    const handleOrderCreated = () => {
      fetchOrders();
    };
    window.addEventListener('wellpos:laundry_order_created', handleOrderCreated);
    return () => {
      window.removeEventListener('wellpos:laundry_order_created', handleOrderCreated);
    };
  }, [activeOutlet?.id]);

  const handleAdvanceStatus = async (order: LaundryQueueOrder) => {
    const nextStatusMap: Record<string, string> = {
      RECEIVED: 'WASHING_DRYING',
      WASHING_DRYING: 'IRONING_PACKING',
      IRONING_PACKING: 'READY_FOR_PICKUP',
      READY_FOR_PICKUP: 'COMPLETED',
      COMPLETED: 'COMPLETED',
    };

    const nextStatus = nextStatusMap[order.status];
    if (!nextStatus || nextStatus === order.status) return;

    // Jika beralih ke READY_FOR_PICKUP, minta alokasi rak
    if (nextStatus === 'READY_FOR_PICKUP') {
      setTargetOrderForRack(order);
      setChosenRackCode(racks[0]?.code || 'RAK-A1');
      setRackAssignModalOpen(true);
      return;
    }

    // Jika beralih ke COMPLETED (penyerahan ke pelanggan)
    if (nextStatus === 'COMPLETED') {
      setTargetOrderForHandover(order);
      setPickedUpByName(order.customerName);
      setHandoverModalOpen(true);
      return;
    }

    try {
      await api.updateLaundryOrderStatus(order.orderId, {
        status: nextStatus,
      });
      fetchOrders();
    } catch {
      dialog.toast('Gagal memperbarui status pengerjaan cucian', 'error');
    }
  };

  const handleConfirmRackAssignment = async () => {
    if (!targetOrderForRack) return;
    try {
      setAssigningRack(true);
      await api.updateLaundryOrderStatus(targetOrderForRack.orderId, {
        status: 'READY_FOR_PICKUP',
        rackCode: chosenRackCode.trim() || undefined,
      });
      setRackAssignModalOpen(false);
      setTargetOrderForRack(null);
      fetchOrders();
      setWaToast({
        message: 'Status Siap Ambil tersimpan & WhatsApp notifikasi dikirimkan ke pelanggan!',
        type: 'success',
      });
      setTimeout(() => setWaToast(null), 4000);
    } catch {
      dialog.toast('Gagal menetapkan nomor rak simpan', 'error');
    } finally {
      setAssigningRack(false);
    }
  };

  const handleConfirmHandover = async () => {
    if (!targetOrderForHandover) return;
    try {
      setProcessingHandover(true);
      await api.updateLaundryOrderStatus(targetOrderForHandover.orderId, {
        status: 'COMPLETED',
        pickedUpBy: pickedUpByName.trim() || targetOrderForHandover.customerName,
        paymentMethod: handoverPayMethod,
      });
      setHandoverModalOpen(false);
      setTargetOrderForHandover(null);
      fetchOrders();
      setWaToast({
        message: 'Cucian telah diserahkan & WhatsApp ucapan terima kasih dikirim!',
        type: 'success',
      });
      setTimeout(() => setWaToast(null), 4000);
    } catch {
      dialog.toast('Gagal menyelesaikan penyerahan pakaian', 'error');
    } finally {
      setProcessingHandover(false);
    }
  };

  const handleSendWhatsAppReady = async (order: LaundryQueueOrder) => {
    if (!order.customerPhone) {
      setWaToast({ message: 'Nomor WhatsApp pelanggan tidak tercatat di nota ini', type: 'error' });
      setTimeout(() => setWaToast(null), 3500);
      return;
    }

    try {
      setSendingWaOrderId(order.orderId);
      const res = await api.sendLaundryWhatsApp(order.orderId, { type: 'READY' });
      if (res.status === 'success') {
        setWaToast({ message: res.message || 'Notifikasi WhatsApp Siap Ambil berhasil dikirim!', type: 'success' });
      } else {
        setWaToast({
          message: res.message || 'Gagal mengirim pesan WhatsApp via gateway',
          type: res.isMock ? 'success' : 'error',
        });
      }
    } catch {
      setWaToast({ message: 'Terjadi gangguan jaringan saat memanggil WhatsApp Gateway', type: 'error' });
    } finally {
      setSendingWaOrderId(null);
      setTimeout(() => setWaToast(null), 4000);
    }
  };

  // Evaluasi Status SLA Pesanan
  const getSlaStatus = (order: LaundryQueueOrder): 'OVERDUE' | 'DUE_TODAY' | 'NORMAL' => {
    if (!order.estimatedReadyAt || order.status === 'COMPLETED') return 'NORMAL';
    const now = new Date();
    const est = new Date(order.estimatedReadyAt);
    if (est.getTime() < now.getTime()) return 'OVERDUE';
    if (
      est.getDate() === now.getDate() &&
      est.getMonth() === now.getMonth() &&
      est.getFullYear() === now.getFullYear()
    ) {
      return 'DUE_TODAY';
    }
    return 'NORMAL';
  };

  const slaStats = useMemo(() => {
    let dueTodayCount = 0;
    let overdueCount = 0;
    orders.forEach((o) => {
      if (o.status === 'COMPLETED') return;
      const sla = getSlaStatus(o);
      if (sla === 'OVERDUE') overdueCount++;
      else if (sla === 'DUE_TODAY') dueTodayCount++;
    });
    return { dueTodayCount, overdueCount };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((item) => {
      if (slaFilter !== 'ALL') {
        const sla = getSlaStatus(item);
        if (slaFilter === 'OVERDUE' && sla !== 'OVERDUE') return false;
        if (slaFilter === 'DUE_TODAY' && sla !== 'DUE_TODAY') return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        item.invoiceNumber.toLowerCase().includes(q) ||
        item.customerName.toLowerCase().includes(q) ||
        (item.customerPhone && item.customerPhone.includes(q)) ||
        (item.rackCode && item.rackCode.toLowerCase().includes(q))
      );
    });
  }, [orders, slaFilter, searchQuery]);

  return (
    <div className="space-y-5 pb-28 sm:pb-16 font-sans animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 min-w-0 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">
              <Layers className="w-4 h-4 shrink-0" />
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-blue-950 tracking-tight">
              Antrian &amp; Status Pengerjaan Cucian
            </h2>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200 shrink-0">
              {activeOutlet?.name || 'Toko Aktif'}
            </span>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Pantau pergerakan cucian mulai dari penimbangan drop-off kasir, proses mesin cuci, meja setrika, hingga penempatan nomor rak pengambilan.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap w-full xl:w-auto shrink-0">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nota, pelanggan, rak (e.g. RAK-A1)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 rounded-xl text-[13px] sm:text-sm font-medium outline-none transition-all"
            />
          </div>

          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer active:scale-95 whitespace-nowrap"
            title="Pindai QR/Barcode Struk Nota Induk"
          >
            <QrCode className="w-4 h-4 text-blue-200" />
            <span>Scan Nota</span>
          </button>

          {/* Core Phase 2: Scan Tag Pakaian */}
          <button
            type="button"
            onClick={() => setTagScannerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 font-extrabold text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer active:scale-95 whitespace-nowrap"
            title="Pindai QR/Barcode Label Tag per Potong Pakaian via Kamera / Scanner USB"
          >
            <Tag className="w-4 h-4 text-sky-700" />
            <span>Scan Tag Pakaian</span>
          </button>

          <button
            type="button"
            onClick={() => setLostAndFoundOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer whitespace-nowrap"
            title="Inventaris Barang Temuan di Saku & Pakaian Tak Bertuan (Lost & Found)"
          >
            <PackageSearch className="w-4 h-4 text-purple-700" />
            <span>Lost &amp; Found</span>
          </button>

          {/* Core Phase 3: Otomasi Notifikasi */}
          {canAccessAutomation && (
            <button
              type="button"
              onClick={() => setAutomationModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer whitespace-nowrap"
              title="Atur Aturan Otomasi & Template Notifikasi Pelanggan"
            >
              <Bell className="w-4 h-4 text-amber-600" />
              <span>Otomasi Notifikasi</span>
            </button>
          )}
        </div>
      </div>

      {/* SLA Instant Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-nowrap pb-1">
        <span className="text-xs font-bold text-slate-500 flex items-center gap-1 shrink-0">
          <Clock className="w-3.5 h-3.5" />
          <span>Filter SLA:</span>
        </span>

        <button
          type="button"
          onClick={() => setSlaFilter('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            slaFilter === 'ALL'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <span>Semua Status</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/10">
            {orders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSlaFilter('DUE_TODAY')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            slaFilter === 'DUE_TODAY'
              ? 'bg-amber-500 text-white shadow-xs'
              : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
          }`}
        >
          <Clock className="w-3 h-3" />
          <span>Jatuh Tempo Hari Ini</span>
          <span
            className={`text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full ${
              slaFilter === 'DUE_TODAY' ? 'bg-black/20 text-white' : 'bg-amber-200 text-amber-900'
            }`}
          >
            {slaStats.dueTodayCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSlaFilter('OVERDUE')}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            slaFilter === 'OVERDUE'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
          }`}
        >
          <AlertOctagon className="w-3 h-3" />
          <span>Terlambat (Overdue SLA)</span>
          <span
            className={`text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full ${
              slaFilter === 'OVERDUE' ? 'bg-black/20 text-white' : 'bg-rose-200 text-rose-900'
            }`}
          >
            {slaStats.overdueCount}
          </span>
        </button>
      </div>

      {/* Mobile Stage Selector Pill Tabs (< md) */}
      <div className="flex md:hidden items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none flex-nowrap">
        {PIPELINE_COLUMNS.map((col) => {
          const count = filteredOrders.filter((i) => i.status === col.key).length;
          const isActive = mobileActiveStage === col.key;
          return (
            <button
              key={col.key}
              type="button"
              onClick={() => setMobileActiveStage(col.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                isActive
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <span>{col.label.replace(/^\d+\.\s*/, '')}</span>
              <span
                className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Kanban Pipeline Board */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs font-semibold animate-pulse">
          Memuat antrean cucian aktif...
        </div>
      ) : (
        <div className="flex flex-col md:flex-row md:overflow-x-auto md:snap-x 2xl:grid 2xl:grid-cols-5 gap-3.5 items-start pb-3 2xl:pb-0 2xl:overflow-visible w-full">
          {PIPELINE_COLUMNS.map((col) => {
            const colItems = filteredOrders.filter((i) => i.status === col.key);

            return (
              <div
                key={col.key}
                className={`bg-slate-50/80 rounded-2xl border border-slate-200 p-3 flex flex-col min-h-[440px] w-full md:w-auto md:min-w-[270px] xl:min-w-[250px] md:snap-start flex-1 ${
                  mobileActiveStage === col.key ? 'flex' : 'hidden md:flex'
                }`}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-200">
                  <span className="text-xs font-extrabold text-slate-800">{col.label}</span>
                  <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-white border border-slate-200 text-slate-700 shadow-2xs">
                    {colItems.length}
                  </span>
                </div>

                {/* Cards list */}
                <div className="space-y-2.5 flex-1 overflow-y-auto">
                  {colItems.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 text-xs">
                      <span>Tidak ada antrean</span>
                    </div>
                  ) : (
                    colItems.map((item) => {
                      const isPaid = item.paymentStatus === 'PAID';
                      const isPartial = item.paymentStatus === 'PARTIALLY_PAID';
                      const slaStatus = getSlaStatus(item);

                      return (
                        <div
                          key={item.id}
                          className={`bg-white rounded-2xl border p-3.5 shadow-xs space-y-2 hover:border-blue-300 transition-all text-xs ${
                            slaStatus === 'OVERDUE'
                              ? 'border-rose-300 ring-1 ring-rose-200'
                              : slaStatus === 'DUE_TODAY'
                              ? 'border-amber-300'
                              : 'border-slate-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-mono font-bold text-blue-950 text-[11px]">
                              {item.invoiceNumber}
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                              {Boolean(item.defectNotes && item.defectNotes.includes('[REWASH/GARANSI:')) && (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white border border-rose-700 flex items-center gap-1 shadow-2xs">
                                  <RotateCcw className="w-2.5 h-2.5" />
                                  <span>GARANSI / REWASH</span>
                                </span>
                              )}

                              {Boolean(item.hasOpenIncident || (item.incidentCount && item.incidentCount > 0)) && (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 shadow-2xs">
                                  <ShieldAlert className="w-2.5 h-2.5 text-rose-600" />
                                  <span>Insiden ({item.incidentCount || 1})</span>
                                </span>
                              )}

                              {slaStatus === 'OVERDUE' ? (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-0.5">
                                  <AlertOctagon className="w-2.5 h-2.5 text-rose-600" />
                                  <span>Terlambat</span>
                                </span>
                              ) : slaStatus === 'DUE_TODAY' ? (
                                <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300 flex items-center gap-0.5">
                                  <Clock className="w-2.5 h-2.5 text-amber-600" />
                                  <span>Hari Ini</span>
                                </span>
                              ) : null}

                              <span
                                className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border ${
                                  isPaid
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : isPartial
                                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                                    : 'bg-rose-50 text-rose-800 border-rose-200'
                                }`}
                              >
                                {isPaid ? 'LUNAS' : isPartial ? 'DP' : 'BELUM BAYAR'}
                              </span>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedOrderForReceipt(item);
                                  setReceiptModalOpen(true);
                                }}
                                className="text-slate-400 hover:text-blue-900 transition-colors p-1"
                                title="Cetak Struk Thermal"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <div>
                            <p className="font-extrabold text-slate-900 leading-tight">{item.customerName}</p>
                            {item.customerPhone && (
                              <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <Phone className="w-2.5 h-2.5" />
                                {item.customerPhone}
                              </p>
                            )}
                          </div>

                          <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-600 truncate max-w-[140px]" title={item.serviceSummary || item.serviceName}>
                              {item.serviceSummary || item.serviceName}
                            </span>
                            <span className="font-bold text-blue-950 shrink-0">
                              {item.totalWeightKg ? `${item.totalWeightKg} Kg` : `${item.totalPieces} Pcs`}
                            </span>
                          </div>

                          {/* 11 Tahapan Produksi Stage Indicator */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrderForTracker(item);
                              setStageTrackerModalOpen(true);
                            }}
                            className="w-full text-left px-2 py-1 rounded-lg bg-blue-50/80 hover:bg-blue-100/80 border border-blue-200/80 text-blue-950 text-[10px] font-bold flex items-center justify-between transition-colors cursor-pointer"
                            title="Klik untuk membuka alur 11 tahapan & check-in operator"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                              <span className="truncate">
                                {LAUNDRY_11_STAGES.find((s) => s.key === item.currentStage)?.label || item.currentStage || '1. Drop-off'}
                              </span>
                            </div>
                            <span className="text-[9px] text-blue-700 font-extrabold uppercase shrink-0">QC</span>
                          </button>

                          {/* Tombol / Badge Sortir & QC Rincian Helai */}
                          {item.isSorted ? (
                            <div
                              onClick={() => {
                                setSelectedOrderForSorting(item);
                                setSortingModalOpen(true);
                              }}
                              className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-900 text-[10px] font-bold flex items-center justify-between transition-colors cursor-pointer"
                              title="Sortir selesai. Klik untuk melihat / edit rincian helai & cetak slip"
                            >
                              <div className="flex items-center gap-1.5 min-w-0">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate">
                                  Sortir: {item.garmentCounts ? Object.values(item.garmentCounts).reduce((a: any, b: any) => Number(a) + Number(b), 0) : item.totalPieces} Pcs
                                </span>
                              </div>
                              <span className="text-[9px] text-emerald-700 font-black uppercase shrink-0">Lihat Slip</span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOrderForSorting(item);
                                setSortingModalOpen(true);
                              }}
                              className="w-full py-1 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-extrabold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                              title="Hitung helai pakaian & catat kendala cacat kain"
                            >
                              <Scale className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                              <span>Sortir &amp; QC Helai</span>
                            </button>
                          )}

                          {item.rackCode && (
                            <div className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[10px] font-bold flex items-center gap-1">
                              <Archive className="w-3 h-3 text-emerald-700" />
                              <span>Lokasi Rak: {item.rackCode}</span>
                            </div>
                          )}

                          {/* Status Badges: QC Checklist & Berat Final (Core Phase 1) */}
                          {((item as any).qcStatus || (item as any).finalWeightKg != null) && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                              {(item as any).qcStatus === 'PASSED' && (
                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  ✅ QC Lolos
                                </span>
                              )}
                              {(item as any).qcStatus === 'REWASH_REQUIRED' && (
                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                  🔄 Perlu Rewash
                                </span>
                              )}
                              {(item as any).finalWeightKg != null && (
                                <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  ⚖️ Akhir: {(item as any).finalWeightKg} kg
                                </span>
                              )}
                            </div>
                          )}

                          {item.transferStatus && item.transferStatus !== 'AT_OUTLET' && (
                            <div className="px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 text-purple-900 text-[9.5px] font-bold flex items-center gap-1">
                              <Truck className="w-3 h-3 text-purple-700" />
                              <span>
                                {item.transferStatus === 'IN_TRANSIT_TO_WORKSHOP'
                                  ? 'OTW ke Workshop'
                                  : item.transferStatus === 'AT_WORKSHOP'
                                  ? 'Sedang di Workshop'
                                  : item.transferStatus === 'IN_TRANSIT_TO_OUTLET'
                                  ? 'OTW Balik ke Toko'
                                  : item.transferStatus}
                              </span>
                            </div>
                          )}

                          <div className="pt-1 flex items-center justify-between text-[10px] text-slate-400">
                            <span>Aroma: {item.perfumeVariant}</span>
                            <span className="font-bold text-slate-700">Rp {item.grandTotal.toLocaleString('id-ID')}</span>
                          </div>

                          {/* Advance Pipeline Button with Mobile Touch Target >= 44px */}
                          {item.status !== 'COMPLETED' && (
                            <button
                              type="button"
                              onClick={() => handleAdvanceStatus(item)}
                              className="w-full mt-1 min-h-[44px] sm:min-h-[36px] py-2 sm:py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-900 font-extrabold rounded-xl text-xs sm:text-[10px] flex items-center justify-center gap-1 border border-blue-200 transition-all cursor-pointer active:scale-95"
                            >
                              <span>
                                {item.status === 'IRONING_PACKING'
                                  ? 'Siap & Masukkan ke Rak'
                                  : item.status === 'READY_FOR_PICKUP'
                                  ? 'Serahkan ke Pelanggan'
                                  : 'Lanjut ke Tahap Berikutnya'}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Quick WhatsApp Send Button (Khusus Status Siap Ambil) with Touch Target >= 44px */}
                          {item.status === 'READY_FOR_PICKUP' && item.customerPhone && (
                            <button
                              type="button"
                              onClick={() => handleSendWhatsAppReady(item)}
                              disabled={sendingWaOrderId === item.orderId}
                              className="w-full mt-1 min-h-[44px] sm:min-h-[36px] py-2 sm:py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold rounded-xl text-xs sm:text-[10px] flex items-center justify-center gap-1 border border-emerald-200 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                              title="Kirim ulang pesan WhatsApp bahwa cucian sudah di rak & siap diambil"
                            >
                              <Send className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{sendingWaOrderId === item.orderId ? 'Mengirim...' : 'Kirim WA Siap Ambil'}</span>
                            </button>
                          )}

                          {/* Tombol QC Checklist & Berat Final (Core Phase 1) with Touch Target >= 44px */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrderForQc(item);
                              setQcModalOpen(true);
                            }}
                            className="w-full mt-1 min-h-[44px] sm:min-h-[36px] py-2 sm:py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-900 font-extrabold rounded-xl text-xs sm:text-[10px] flex items-center justify-center gap-1 border border-blue-200 transition-all cursor-pointer active:scale-95"
                            title="QC Checklist Pasca-Proses & Timbang Berat Final"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-700" />
                            <span>QC &amp; Berat Final</span>
                          </button>

                          {/* Tombol Item & Tag (Core Phase 2) with Touch Target >= 44px */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrderForTracking({
                                id: item.orderId,
                                invoiceNumber: item.invoiceNumber,
                                customerName: item.customerName,
                              });
                              setItemTrackingModalOpen(true);
                            }}
                            className="w-full mt-1 min-h-[44px] sm:min-h-[36px] py-2 sm:py-1.5 px-2 bg-sky-50 hover:bg-sky-100 text-sky-900 font-extrabold rounded-xl text-xs sm:text-[10px] flex items-center justify-center gap-1 border border-sky-200 transition-all cursor-pointer active:scale-95"
                            title="Item-Level Tracking Pakaian & Serah Terima Sebagian"
                          >
                            <Tag className="w-3.5 h-3.5 text-sky-700" />
                            <span>Item &amp; Tag</span>
                          </button>

                          {/* Tombol Cuci Ulang Garansi (Khusus Status Siap Ambil / Selesai) with Touch Target >= 44px */}
                          {(item.status === 'READY_FOR_PICKUP' || item.status === 'COMPLETED') && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOrderForRewash(item);
                                setRewashModalOpen(true);
                              }}
                              className="w-full mt-1 min-h-[44px] sm:min-h-[36px] py-2 sm:py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-800 font-extrabold rounded-xl text-xs sm:text-[10px] flex items-center justify-center gap-1 border border-rose-200 transition-all cursor-pointer active:scale-95"
                              title="Klaim Garansi Cuci Ulang Pelanggan (Rp 0)"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                              <span>Cuci Ulang (Garansi)</span>
                            </button>
                          )}

                          {/* Tombol Lapor Insiden Produksi */}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrderForIncident(item);
                              setIncidentModalOpen(true);
                            }}
                            className="w-full mt-1 min-h-[44px] sm:min-h-[36px] py-2 sm:py-1.5 px-2 bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-800 font-extrabold rounded-xl text-xs sm:text-[10px] flex items-center justify-center gap-1 border border-slate-200 hover:border-rose-200 transition-all cursor-pointer active:scale-95"
                            title="Catat Pakaian Rusak / Hilang"
                          >
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                            <span>Lapor Insiden</span>
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Cetak Struk Thermal */}
      {receiptModalOpen && selectedOrderForReceipt && (
        <LaundryReceiptModal
          isOpen={receiptModalOpen}
          onClose={() => {
            setReceiptModalOpen(false);
            setSelectedOrderForReceipt(null);
          }}
          order={selectedOrderForReceipt}
          outlet={activeOutlet}
        />
      )}

      {/* Modal Alokasi Rak Simpan saat cucian Siap Ambil */}
      {rackAssignModalOpen && targetOrderForRack && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                <Archive className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Alokasikan ke Rak Penyimpanan</h3>
                <p className="text-xs text-slate-500">Nota {targetOrderForRack.invoiceNumber} — {targetOrderForRack.customerName}</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Pilih Kode Rak / Hanger
              </label>
              <div className="relative">
                <select
                  value={chosenRackCode}
                  onChange={(e) => setChosenRackCode(e.target.value)}
                  className="w-full px-3 py-2 pr-10 text-sm rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900 appearance-none"
                >
                  {racks.map((r) => (
                    <option key={r.id} value={r.code}>
                      {r.code} ({r.name}) — Slot: {r.currentCount || 0}/{r.capacity}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRackAssignModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={assigningRack}
                onClick={handleConfirmRackAssignment}
                className="px-5 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs disabled:opacity-50"
              >
                {assigningRack ? 'Menyimpan...' : 'Simpan & Siap Ambil'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Penyerahan Cucian ke Pelanggan (Handover & Pelunasan) */}
      {handoverModalOpen && targetOrderForHandover && (() => {
        const remaining = Math.max(0, targetOrderForHandover.grandTotal - (targetOrderForHandover.paidAmount || 0));
        const needPayment = remaining > 0;

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
            <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Penyerahan Cucian ke Pelanggan</h3>
                  <p className="text-xs text-slate-500">Nota {targetOrderForHandover.invoiceNumber}</p>
                </div>
              </div>

              {/* Status Tagihan */}
              {needPayment ? (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-rose-900 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" /> Ada Sisa Tagihan:
                    </span>
                    <span className="font-black text-sm text-rose-700">
                      Rp {remaining.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <p className="text-[11px] text-rose-800 leading-snug">
                    Pelanggan wajib melunasi sisa tagihan sebelum pakaian diserahkan.
                  </p>

                  <div className="pt-2 border-t border-rose-200/80">
                    <label className="block text-[11px] font-bold text-rose-900 mb-1">
                      Metode Pelunasan Kasir
                    </label>
                    <div className="relative">
                      <select
                        value={handoverPayMethod}
                        onChange={(e) => setHandoverPayMethod(e.target.value as any)}
                        className="w-full px-3 py-1.5 pr-10 text-xs rounded-xl border border-rose-300 bg-white text-slate-800 font-semibold focus:outline-none appearance-none"
                      >
                        <option value="CASH">Tunai (Cash)</option>
                        <option value="QRIS">QRIS Statis / Dinamis</option>
                        <option value="TRANSFER">Transfer Bank</option>
                      </select>
                      <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Tagihan sudah LUNAS sepenuhnya. Pakaian siap diserahkan.</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nama Penerima Pakaian
                </label>
                <input
                  type="text"
                  value={pickedUpByName}
                  onChange={(e) => setPickedUpByName(e.target.value)}
                  placeholder="Nama orang yang mengambil pakaian"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-900 font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setHandoverModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={processingHandover}
                  onClick={handleConfirmHandover}
                  className="px-5 py-2 text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white rounded-xl shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                >
                  {needPayment && <Coins className="w-3.5 h-3.5" />}
                  <span>{processingHandover ? 'Memproses...' : needPayment ? 'Lunasi & Serahkan' : 'Serahkan Pakaian'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal 11 Tahapan Produksi & QC Riil */}
      <LaundryStageTrackerModal
        isOpen={stageTrackerModalOpen}
        onClose={() => setStageTrackerModalOpen(false)}
        order={selectedOrderForTracker}
        onStageUpdated={() => {
          fetchOrders();
        }}
      />

      {/* Modal Sortir & QC Rincian Helai + Cetak Slip */}
      <LaundrySortingModal
        isOpen={sortingModalOpen}
        onClose={() => setSortingModalOpen(false)}
        order={selectedOrderForSorting}
        onSaved={() => {
          fetchOrders();
        }}
      />

      {/* Modal Barcode Scanner Nota */}
      {scannerOpen && (
        <LaundryBarcodeScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          orders={orders}
          onOrderFound={(order) => {
            setSearchQuery(order.invoiceNumber);
            setScannerOpen(false);
            setWaToast({
              message: `Nota ${order.invoiceNumber} (${order.customerName}) ditemukan!`,
              type: 'success',
            });
            setTimeout(() => setWaToast(null), 3500);
          }}
        />
      )}

      {/* Modal Klaim Garansi Cuci Ulang (Rewash Rp 0) */}
      {rewashModalOpen && selectedOrderForRewash && (
        <LaundryRewashModal
          isOpen={rewashModalOpen}
          onClose={() => {
            setRewashModalOpen(false);
            setSelectedOrderForRewash(null);
          }}
          order={selectedOrderForRewash}
          onSuccess={() => {
            fetchOrders();
            fetchRacks();
            setWaToast({
              message: `Garansi cuci ulang (Rewash Rp 0) untuk Nota ${selectedOrderForRewash.invoiceNumber} berhasil diaktifkan!`,
              type: 'success',
            });
            setTimeout(() => setWaToast(null), 3500);
          }}
        />
      )}

      {/* Modal Lapor Insiden Produksi */}
      {incidentModalOpen && selectedOrderForIncident && (
        <LaundryIncidentModal
          isOpen={incidentModalOpen}
          onClose={() => {
            setIncidentModalOpen(false);
            setSelectedOrderForIncident(null);
          }}
          order={selectedOrderForIncident}
          outletId={activeOutlet?.id || ''}
          onSuccess={() => {
            fetchOrders();
            setWaToast({
              message: 'Laporan insiden berhasil dicatat',
              type: 'success',
            });
            setTimeout(() => setWaToast(null), 3500);
          }}
        />
      )}

      {/* Modal QC Checklist Pasca-Cuci & Berat Final (Core Phase 1) */}
      {qcModalOpen && selectedOrderForQc && (
        <LaundryQcAndWeightModal
          isOpen={qcModalOpen}
          onClose={() => {
            setQcModalOpen(false);
            setSelectedOrderForQc(null);
          }}
          orderId={selectedOrderForQc.orderId}
          invoiceNumber={selectedOrderForQc.invoiceNumber}
          customerName={selectedOrderForQc.customerName}
          initialWeightKg={(selectedOrderForQc as any).initialWeightKg ?? selectedOrderForQc.totalWeightKg}
          finalWeightKg={(selectedOrderForQc as any).finalWeightKg}
          currentQcChecklist={(selectedOrderForQc as any).qcChecklist}
          currentQcStatus={(selectedOrderForQc as any).qcStatus}
          onSaved={() => fetchOrders()}
        />
      )}

      {/* Drawer Lost & Found (Core Phase 1) */}
      {activeOutlet && (
        <LaundryLostAndFoundDrawer
          isOpen={lostAndFoundOpen}
          onClose={() => setLostAndFoundOpen(false)}
          activeOutletId={activeOutlet.id}
          activeOutletName={activeOutlet.name}
        />
      )}

      {/* Modal Quick Tag Scanner (Core Phase 2) */}
      {tagScannerOpen && (
        <LaundryTagScannerModal
          isOpen={tagScannerOpen}
          onClose={() => setTagScannerOpen(false)}
          onStageChanged={() => fetchOrders()}
        />
      )}

      {/* Modal Item-Level Tracking (Core Phase 2) */}
      {itemTrackingModalOpen && selectedOrderForTracking && (
        <LaundryItemTrackingModal
          isOpen={itemTrackingModalOpen}
          onClose={() => {
            setItemTrackingModalOpen(false);
            setSelectedOrderForTracking(null);
          }}
          orderId={selectedOrderForTracking.id}
          invoiceNumber={selectedOrderForTracking.invoiceNumber}
          customerName={selectedOrderForTracking.customerName}
          onUpdated={() => fetchOrders()}
        />
      )}

      {/* Modal Otomasi Notifikasi (Core Phase 3) */}
      <NotificationAutomationModal
        isOpen={automationModalOpen}
        onClose={() => setAutomationModalOpen(false)}
        activeOutlet={activeOutlet}
      />

      {/* Floating Feedback Toast WhatsApp Gateway */}
      {waToast && (
        <div
          className={`fixed bottom-24 md:bottom-6 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold animate-fadeIn transition-all ${
            waToast.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
              : 'bg-rose-950 text-rose-100 border-rose-700'
          }`}
        >
          {waToast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{waToast.message}</span>
        </div>
      )}
    </div>
  );
};
