import React, { useState, useEffect } from 'react';
import {
  Layers,
  Search,
  Archive,
  ChevronRight,
  Plus,
  Phone,
  User,
  Printer,
  CheckCircle2,
  AlertCircle,
  Coins,
  Send,
  Truck,
  Award,
  Scale,
} from 'lucide-react';
import type { Outlet } from '../types/outlet';
import { api } from '../services/api';
import type { LaundryQueueOrder, LaundryRack, LaundryService } from '../types/laundry';
import { LAUNDRY_11_STAGES } from '../types/laundry';
import { LaundryReceiptModal } from '../components/laundry/LaundryReceiptModal';
import { LaundryStageTrackerModal } from '../components/laundry/LaundryStageTrackerModal';
import { LaundryProductionKpiModal } from '../components/laundry/LaundryProductionKpiModal';
import { LaundrySortingModal } from '../components/LaundrySortingModal';

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
  const [orders, setOrders] = useState<LaundryQueueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [racks, setRacks] = useState<LaundryRack[]>([]);
  const [services, setServices] = useState<LaundryService[]>([]);

  // State Modal Struk Thermal
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [selectedOrderForReceipt, setSelectedOrderForReceipt] = useState<LaundryQueueOrder | null>(null);

  // State Modal Terima Cucian Baru
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [weightKg, setWeightKg] = useState('3.0');
  const [totalPieces, setTotalPieces] = useState('10');
  const [perfumeVariant, setPerfumeVariant] = useState('Lavender');
  const [paymentChoice, setPaymentChoice] = useState<'UNPAID' | 'PAID' | 'PARTIAL'>('UNPAID');
  const [depositAmount, setDepositAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'TRANSFER'>('CASH');
  const [customerNotes, setCustomerNotes] = useState('');
  const [savingOrder, setSavingOrder] = useState(false);

  // State Modal Penempatan Rak
  const [rackAssignModalOpen, setRackAssignModalOpen] = useState(false);
  const [targetOrderForRack, setTargetOrderForRack] = useState<LaundryQueueOrder | null>(null);
  const [chosenRackCode, setChosenRackCode] = useState('');
  const [assigningRack, setAssigningRack] = useState(false);

  // State Modal Penyerahan Cucian (Handover & Pelunasan)
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [targetOrderForHandover, setTargetOrderForHandover] = useState<LaundryQueueOrder | null>(null);
  const [handoverPayMethod, setHandoverPayMethod] = useState<'CASH' | 'QRIS'>('CASH');
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

  // State Modal Penilaian Kinerja Staf (KPI)
  const [kpiModalOpen, setKpiModalOpen] = useState(false);

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

  const fetchRacksAndServices = async () => {
    try {
      const [rackRes, serviceRes] = await Promise.all([
        api.getLaundryRacks(activeOutlet?.id),
        api.getLaundryServices(),
      ]);
      if (rackRes.status === 'success' && Array.isArray(rackRes.data)) {
        setRacks(rackRes.data);
      }
      if (serviceRes.status === 'success' && Array.isArray(serviceRes.data)) {
        setServices(serviceRes.data);
        if (serviceRes.data.length > 0 && !selectedServiceId) {
          setSelectedServiceId(serviceRes.data[0].id);
        }
      }
    } catch {
      // Abaikan
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchRacksAndServices();
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
      alert('Gagal memperbarui status pengerjaan cucian');
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
      alert('Gagal menetapkan nomor rak simpan');
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
      alert('Gagal menyelesaikan penyerahan pakaian');
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

  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOutlet?.id || !customerName.trim()) return;

    const currentService = services.find((s) => s.id === selectedServiceId) || services[0];
    const unitPrice = currentService ? Number(currentService.price) : 8000;
    const qty = parseFloat(weightKg) || 1;

    try {
      setSavingOrder(true);
      const payload = {
        outletId: activeOutlet.id,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        items: [
          {
            serviceId: currentService?.id,
            name: currentService?.name || 'Cuci Komplit Reguler',
            category: currentService?.category || 'KILOAN',
            quantity: qty,
            unit: currentService?.unit || 'KG',
            unitPrice,
          },
        ],
        totalPieces: parseInt(totalPieces, 10) || 0,
        perfumeVariant,
        estimatedReadyHours: currentService?.durationHours || 48,
        depositAmount: paymentChoice === 'PARTIAL' ? parseFloat(depositAmount) || 0 : paymentChoice === 'PAID' ? unitPrice * qty : 0,
        paymentMethod: paymentChoice === 'UNPAID' ? 'UNPAID' : paymentMethod,
        customerNotes: customerNotes.trim() || undefined,
      };

      const res = await api.createLaundryOrder(payload);
      if (res.status === 'success') {
        setShowNewOrderModal(false);
        setCustomerName('');
        setCustomerPhone('');
        setCustomerNotes('');
        setPaymentChoice('UNPAID');
        await fetchOrders();

        // Tawarkan langsung pratinjau struk thermal
        if (res.data) {
          const newOrderQueueItem: LaundryQueueOrder = {
            id: res.data.laundryDetail?.id || res.data.id,
            orderId: res.data.id,
            invoiceNumber: res.data.invoiceNumber,
            status: 'RECEIVED',
            customerName: customerName.trim(),
            customerPhone: customerPhone.trim() || null,
            serviceName: currentService?.name || 'Cuci Komplit Reguler',
            totalWeightKg: qty,
            totalPieces: parseInt(totalPieces, 10) || 0,
            grandTotal: unitPrice * qty,
            paidAmount: paymentChoice === 'PAID' ? unitPrice * qty : paymentChoice === 'PARTIAL' ? parseFloat(depositAmount) || 0 : 0,
            paymentStatus: res.data.paymentStatus,
            perfumeVariant,
            customerNotes: customerNotes.trim() || null,
            estimatedReadyAt: res.data.laundryDetail?.estimatedReadyAt || null,
            createdAt: new Date().toISOString(),
          };
          setSelectedOrderForReceipt(newOrderQueueItem);
          setReceiptModalOpen(true);
        }
      } else {
        alert(res.message || 'Gagal membuat pesanan');
      }
    } catch {
      alert('Terjadi kesalahan saat menyimpan pesanan laundry');
    } finally {
      setSavingOrder(false);
    }
  };

  const filteredOrders = orders.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      item.invoiceNumber.toLowerCase().includes(q) ||
      item.customerName.toLowerCase().includes(q) ||
      (item.customerPhone && item.customerPhone.includes(q)) ||
      (item.rackCode && item.rackCode.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 pb-28 sm:pb-16 font-sans animate-fadeIn">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div className="min-w-0">
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

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nota, pelanggan, rak (e.g. RAK-A1)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 rounded-xl text-xs font-medium outline-none transition-all"
            />
          </div>

          <button
            type="button"
            onClick={() => setKpiModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
            title="Lihat Rekapitulasi Output & Penilaian Kinerja Staf"
          >
            <Award className="w-4 h-4 text-amber-700" />
            <span>Penilaian Staf (KPI)</span>
          </button>

          <button
            onClick={() => setShowNewOrderModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Terima Cucian (Drop-off)</span>
          </button>
        </div>
      </div>

      {/* Kanban Pipeline Board */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-xs font-semibold animate-pulse">
          Memuat antrean cucian aktif...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3.5 items-start">
          {PIPELINE_COLUMNS.map((col) => {
            const colItems = filteredOrders.filter((i) => i.status === col.key);

            return (
              <div
                key={col.key}
                className="bg-slate-50/80 rounded-2xl border border-slate-200 p-3 flex flex-col min-h-[440px]"
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

                      return (
                        <div
                          key={item.id}
                          className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs space-y-2 hover:border-blue-300 transition-all text-xs"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-mono font-bold text-blue-950 text-[11px]">
                              {item.invoiceNumber}
                            </span>
                            <div className="flex items-center gap-1.5">
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
                                className="text-slate-400 hover:text-blue-900 transition-colors p-0.5"
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
                            <span className="font-semibold text-slate-600 truncate max-w-[120px]">
                              {item.serviceName}
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

                          {/* Advance Pipeline Button */}
                          {item.status !== 'COMPLETED' && (
                            <button
                              type="button"
                              onClick={() => handleAdvanceStatus(item)}
                              className="w-full mt-1 py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold rounded-lg text-[10px] flex items-center justify-center gap-1 border border-blue-200 transition-all cursor-pointer"
                            >
                              <span>
                                {item.status === 'IRONING_PACKING'
                                  ? 'Siap & Masukkan ke Rak'
                                  : item.status === 'READY_FOR_PICKUP'
                                  ? 'Serahkan ke Pelanggan'
                                  : 'Lanjut ke Tahap Berikutnya'}
                              </span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}

                          {/* Quick WhatsApp Send Button (Khusus Status Siap Ambil) */}
                          {item.status === 'READY_FOR_PICKUP' && item.customerPhone && (
                            <button
                              type="button"
                              onClick={() => handleSendWhatsAppReady(item)}
                              disabled={sendingWaOrderId === item.orderId}
                              className="w-full mt-1 py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[10px] flex items-center justify-center gap-1 border border-emerald-200 transition-all cursor-pointer"
                              title="Kirim ulang pesan WhatsApp bahwa cucian sudah di rak & siap diambil"
                            >
                              <Send className="w-3 h-3 text-emerald-600" />
                              <span>{sendingWaOrderId === item.orderId ? 'Mengirim...' : 'Kirim WA Siap Ambil'}</span>
                            </button>
                          )}
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

      {/* Modal Terima Cucian Baru (POS Drop-off Timbangan) */}
      {showNewOrderModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Terima Cucian Baru (Drop-off)</h3>
                  <p className="text-xs text-slate-500">Input timbangan kiloan, satuan, dan aroma parfum</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewOrderModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrderSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1">
                {/* 1. Data Pelanggan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nama Pelanggan <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Bpk. Bambang"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      No. WhatsApp / HP
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="tel"
                        placeholder="0812xxxx"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Pilihan Layanan */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Pilihan Paket Layanan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedServiceId}
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — Rp {Number(s.price).toLocaleString('id-ID')} / {s.unit} ({s.durationHours} Jam)
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Timbangan & Jumlah Potong */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Berat Timbangan (Kg) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0.1"
                      required
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="w-full px-3 py-2 text-sm font-mono font-bold rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Jumlah Helai Pakaian
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={totalPieces}
                      onChange={(e) => setTotalPieces(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 4. Aroma Parfum */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Aroma Parfum Pilihan
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Lavender', 'Akasia', 'Ocean Fresh', 'Snappy', 'Downy Black', 'Tanpa Parfum'].map((p) => (
                      <button
                        type="button"
                        key={p}
                        onClick={() => setPerfumeVariant(p)}
                        className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all border ${
                          perfumeVariant === p
                            ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 5. Pilihan Pembayaran */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status &amp; Pembayaran Kasir
                  </label>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setPaymentChoice('UNPAID')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                        paymentChoice === 'UNPAID'
                          ? 'bg-rose-50 text-rose-900 border-rose-300 ring-1 ring-rose-300'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Bayar Nanti (Ambil)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentChoice('PARTIAL')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                        paymentChoice === 'PARTIAL'
                          ? 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-300'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Uang Muka (DP)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentChoice('PAID')}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all ${
                        paymentChoice === 'PAID'
                          ? 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-1 ring-emerald-300'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Lunas di Awal
                    </button>
                  </div>

                  {paymentChoice !== 'UNPAID' && (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                      {paymentChoice === 'PARTIAL' && (
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Nominal DP yang Diterima (Rp)
                          </label>
                          <input
                            type="number"
                            min="1000"
                            placeholder="Contoh: 20000"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none"
                          />
                        </div>
                      )}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Metode Pembayaran
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as any)}
                          className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none"
                        >
                          <option value="CASH">Tunai (Cash)</option>
                          <option value="QRIS">QRIS Statis / Dinamis</option>
                          <option value="TRANSFER">Transfer Bank</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catatan Khusus Pakaian
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Contoh: Noda minyak di kerah, luntur dipisah..."
                    value={customerNotes}
                    onChange={(e) => setCustomerNotes(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewOrderModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingOrder}
                  className="px-5 py-2 text-sm font-semibold bg-blue-900 hover:bg-blue-800 text-white rounded-xl transition-colors shadow-sm disabled:opacity-50"
                >
                  {savingOrder ? 'Mencatat...' : 'Buat Nota & Terima Cucian'}
                </button>
              </div>
            </form>
          </div>
        </div>
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
              <select
                value={chosenRackCode}
                onChange={(e) => setChosenRackCode(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white font-mono font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900"
              >
                {racks.map((r) => (
                  <option key={r.id} value={r.code}>
                    {r.code} ({r.name}) — Slot: {r.currentCount || 0}/{r.capacity}
                  </option>
                ))}
              </select>
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
                    <select
                      value={handoverPayMethod}
                      onChange={(e) => setHandoverPayMethod(e.target.value as any)}
                      className="w-full px-3 py-1.5 text-xs rounded-xl border border-rose-300 bg-white text-slate-800 font-semibold focus:outline-none"
                    >
                      <option value="CASH">Tunai (Cash)</option>
                      <option value="QRIS">QRIS Statis / Dinamis</option>
                    </select>
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

      {/* Modal Leaderboard & Penilaian Kinerja Staf (KPI) */}
      <LaundryProductionKpiModal
        isOpen={kpiModalOpen}
        onClose={() => setKpiModalOpen(false)}
      />

      {/* Floating Feedback Toast WhatsApp Gateway */}
      {waToast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold animate-fadeIn transition-all ${
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
