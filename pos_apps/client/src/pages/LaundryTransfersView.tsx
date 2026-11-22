import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  Printer,
  CheckCircle2,
  AlertCircle,
  FileText,
  ArrowRight,
  Building2,
  Clock,
  PackageCheck,
  ChevronDown,
  Settings,
  MapPin,
  Phone,
  Camera,
  Check,
  X,
  Loader2,
  Trash2,
} from 'lucide-react';
import type { Outlet } from '../types/outlet';
import { api } from '../services/api';
import type {
  LaundryTransferManifest,
  AvailableOrderForManifest,
  LaundryDeliveryConfig,
  LaundryDeliveryTask,
  LaundryDeliveryKpi,
  LaundryDeliveryZone,
} from '../types/laundry';

interface LaundryTransfersViewProps {
  activeOutlet: Outlet | null;
}

export const LaundryTransfersView: React.FC<LaundryTransfersViewProps> = ({ activeOutlet }) => {
  // Main Tab State: 'DELIVERY' | 'WORKSHOP'
  const [activeMainTab, setActiveMainTab] = useState<'DELIVERY' | 'WORKSHOP'>('DELIVERY');

  // ==========================================
  // TAB 1: DELIVERY PELANGGAN STATE
  // ==========================================
  const [deliveryTasks, setDeliveryTasks] = useState<LaundryDeliveryTask[]>([]);
  const [deliveryKpis, setDeliveryKpis] = useState<LaundryDeliveryKpi>({
    pendingPickup: 0,
    readyToDeliver: 0,
    outForDelivery: 0,
    deliveredToday: 0,
    totalCodRemaining: 0,
  });
  const [deliveryLoading, setDeliveryLoading] = useState(true);
  const [deliveryFilter, setDeliveryFilter] = useState<'ALL' | 'PENDING_PICKUP' | 'READY_TO_DELIVER' | 'OUT_FOR_DELIVERY' | 'DELIVERED'>('ALL');
  const [deliverySearch, setDeliverySearch] = useState('');

  // Delivery Config State
  const [deliveryConfig, setDeliveryConfig] = useState<LaundryDeliveryConfig | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configDraft, setConfigDraft] = useState<LaundryDeliveryConfig>({
    enabled: true,
    freeDeliveryMinAmount: 50000,
    freeDeliveryMinWeightKg: 5,
    roundTripMultiplier: 1.8,
    zones: [],
  });
  const [savingConfig, setSavingConfig] = useState(false);

  // Modal Selesaikan Pengantaran & Pelunasan COD
  const [taskToComplete, setTaskToComplete] = useState<LaundryDeliveryTask | null>(null);
  const [completeCourierName, setCompleteCourierName] = useState('');
  const [completeNotes, setCompleteNotes] = useState('');
  const [collectCodPayment, setCollectCodPayment] = useState(true);
  const [codPaymentMethod, setCodPaymentMethod] = useState<'CASH' | 'QRIS' | 'TRANSFER'>('CASH');
  const [submittingComplete, setSubmittingComplete] = useState(false);
  const [proofPhotoFile, setProofPhotoFile] = useState<File | null>(null);
  const [proofPhotoPreview, setProofPhotoPreview] = useState<string | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);

  // Modal Tugaskan Kurir (Jemput / Antar)
  const [taskToDispatch, setTaskToDispatch] = useState<{ task: LaundryDeliveryTask; nextStatus: 'PICKED_UP' | 'OUT_FOR_DELIVERY' } | null>(null);
  const [dispatchCourierName, setDispatchCourierName] = useState('');
  const [dispatchCourierPhone, setDispatchCourierPhone] = useState('');
  const [submittingDispatch, setSubmittingDispatch] = useState(false);

  // ==========================================
  // TAB 2: TRANSFER WORKSHOP & MANIFEST STATE
  // ==========================================
  const [manifests, setManifests] = useState<LaundryTransferManifest[]>([]);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [workshopTabFilter, setWorkshopTabFilter] = useState<'ALL' | 'TO_WORKSHOP' | 'TO_OUTLET'>('ALL');
  const [workshopSearchQuery, setWorkshopSearchQuery] = useState('');
  const [workshops, setWorkshops] = useState<Outlet[]>([]);

  // Modal State Buat Manifest Baru
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [direction, setDirection] = useState<'TO_WORKSHOP' | 'TO_OUTLET'>('TO_WORKSHOP');
  const [targetOutletId, setTargetOutletId] = useState('');
  const [driverName, setDriverName] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [notes, setNotes] = useState('');
  const [availableOrders, setAvailableOrders] = useState<AvailableOrderForManifest[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [submittingManifest, setSubmittingManifest] = useState(false);

  // Modal State Cetak Surat Jalan
  const [selectedManifestForPrint, setSelectedManifestForPrint] = useState<LaundryTransferManifest | null>(null);

  // State Konfirmasi Terima
  const [receiverName, setReceiverName] = useState('');
  const [manifestToReceive, setManifestToReceive] = useState<LaundryTransferManifest | null>(null);

  // Toast Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // ==========================================
  // FETCH DATA HOOKS
  // ==========================================
  const fetchDeliveryConfig = async () => {
    if (!activeOutlet?.id) return;
    try {
      const res = await api.getLaundryDeliveryConfig(activeOutlet.id);
      if (res.status === 'success' && res.data) {
        setDeliveryConfig(res.data);
        setConfigDraft(res.data);
      }
    } catch {
      // Abaikan fallback default
    }
  };

  const fetchDeliveries = async () => {
    if (!activeOutlet?.id) return;
    try {
      setDeliveryLoading(true);
      const res = await api.getLaundryDeliveries({
        outletId: activeOutlet.id,
        status: deliveryFilter !== 'ALL' ? deliveryFilter : undefined,
        search: deliverySearch.trim() || undefined,
      });
      if (res.status === 'success' && res.data) {
        setDeliveryTasks(res.data.tasks || []);
        if (res.data.summary) {
          setDeliveryKpis(res.data.summary);
        }
      }
    } catch {
      showToast('Gagal memuat daftar tugas pengantaran', 'error');
    } finally {
      setDeliveryLoading(false);
    }
  };

  const fetchManifests = async () => {
    try {
      setManifestLoading(true);
      const res = await api.getLaundryManifests();
      if (res.status === 'success' && Array.isArray(res.data)) {
        setManifests(res.data);
      }
    } catch {
      showToast('Gagal memuat daftar surat jalan manifest', 'error');
    } finally {
      setManifestLoading(false);
    }
  };

  const fetchWorkshops = async () => {
    try {
      const res = await api.getLaundryWorkshops();
      if (res.status === 'success' && Array.isArray(res.data)) {
        setWorkshops(res.data);
      }
    } catch {
      // Abaikan
    }
  };

  useEffect(() => {
    if (activeOutlet?.id) {
      fetchDeliveryConfig();
      fetchDeliveries();
      fetchManifests();
      fetchWorkshops();
    }
  }, [activeOutlet?.id]);

  useEffect(() => {
    fetchDeliveries();
  }, [deliveryFilter, deliverySearch]);

  // Load order yang siap dikirim saat modal create manifest dibuka
  useEffect(() => {
    if (!showCreateModal || !activeOutlet?.id) return;

    const loadOrders = async () => {
      try {
        setLoadingOrders(true);
        setSelectedOrderIds([]);
        const res = await api.getAvailableOrdersForManifest(activeOutlet.id, direction);
        if (res.status === 'success' && Array.isArray(res.data)) {
          setAvailableOrders(res.data);
          setSelectedOrderIds(res.data.map((o: AvailableOrderForManifest) => o.orderId));
        }
      } catch {
        showToast('Gagal memuat daftar cucian yang siap dikirim', 'error');
      } finally {
        setLoadingOrders(false);
      }
    };

    loadOrders();
  }, [showCreateModal, direction, activeOutlet?.id]);

  // Default target outlet saat workshop list siap
  useEffect(() => {
    if (workshops.length > 0 && !targetOutletId) {
      const otherOutlets = workshops.filter((w) => w.id !== activeOutlet?.id);
      const preferred = otherOutlets.find((w) => w.isWorkshop) || otherOutlets[0];
      if (preferred) setTargetOutletId(preferred.id);
    }
  }, [workshops, activeOutlet?.id]);

  // Syarat tampil Tab 2 (Transfer Workshop): lebih dari 1 outlet workshop/toko ATAU ada manifest terbit
  const hasMultipleOutletsOrManifests = workshops.length > 1 || manifests.length > 0 || !!activeOutlet?.isWorkshop;

  // ==========================================
  // HANDLERS DELIVERY PELANGGAN
  // ==========================================
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOutlet?.id) return;
    try {
      setSavingConfig(true);
      const res = await api.updateLaundryDeliveryConfig({ outletId: activeOutlet.id, ...configDraft });
      if (res.status === 'success') {
        setDeliveryConfig(configDraft);
        setShowConfigModal(false);
        showToast('Konfigurasi tarif delivery berhasil diperbarui!');
      } else {
        showToast(res.message || 'Gagal menyimpan konfigurasi', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat menyimpan konfigurasi', 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleDispatchCourierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskToDispatch) return;
    try {
      setSubmittingDispatch(true);
      const res = await api.updateLaundryDeliveryStatus(taskToDispatch.task.id, {
        deliveryStatus: taskToDispatch.nextStatus,
        courierName: dispatchCourierName.trim() || undefined,
        courierPhone: dispatchCourierPhone.trim() || undefined,
      });
      if (res.status === 'success') {
        showToast(
          taskToDispatch.nextStatus === 'PICKED_UP'
            ? 'Status cucian diperbarui: Telah dijemput kurir'
            : 'Status cucian diperbarui: Sedang diantar ke pelanggan'
        );
        setTaskToDispatch(null);
        setDispatchCourierName('');
        setDispatchCourierPhone('');
        fetchDeliveries();
      } else {
        showToast(res.message || 'Gagal memperbarui status pengantaran', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan', 'error');
    } finally {
      setSubmittingDispatch(false);
    }
  };

  const handleCompleteDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskToComplete) return;

    try {
      setSubmittingComplete(true);
      let proofPhotoUrl: string | undefined = undefined;

      if (proofPhotoFile) {
        setUploadingProof(true);
        try {
          const toBase64 = (file: File): Promise<string> =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.readAsDataURL(file);
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = (err) => reject(err);
            });
          const base64Str = await toBase64(proofPhotoFile);
          const uploadRes = await api.uploadLaundryConditionPhoto({
            image: base64Str,
            caption: 'Bukti Pengantaran Selesai',
            stage: 'DELIVERED',
          });
          if (uploadRes.status === 'success' && uploadRes.data?.url) {
            proofPhotoUrl = uploadRes.data.url;
          }
        } catch {
          // Lanjutkan jika upload gagal
        } finally {
          setUploadingProof(false);
        }
      }

      const res = await api.updateLaundryDeliveryStatus(taskToComplete.id, {
        deliveryStatus: 'DELIVERED',
        courierName: completeCourierName.trim() || undefined,
        deliveryProofPhotoUrl: proofPhotoUrl,
        deliveryNotes: completeNotes.trim() || undefined,
        collectCodPayment: collectCodPayment && taskToComplete.order.paymentStatus !== 'PAID',
        codPaymentMethod,
      });

      if (res.status === 'success') {
        showToast('Pengantaran cucian selesai! ' + (collectCodPayment ? 'Pelunasan COD berhasil dicatat.' : ''));
        setTaskToComplete(null);
        setCompleteCourierName('');
        setCompleteNotes('');
        setProofPhotoFile(null);
        setProofPhotoPreview(null);
        fetchDeliveries();
      } else {
        showToast(res.message || 'Gagal mengonfirmasi pengantaran', 'error');
      }
    } catch {
      showToast('Terjadi gangguan jaringan saat menyelesaikan pengantaran', 'error');
    } finally {
      setSubmittingComplete(false);
    }
  };

  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setProofPhotoFile(file);
      setProofPhotoPreview(URL.createObjectURL(file));
    }
  };

  // Helper WhatsApp Kurir OTW
  const handleOpenWhatsAppKurir = (task: LaundryDeliveryTask) => {
    const phone = task.order.customer?.phone || task.courierPhone;
    if (!phone) {
      showToast('Nomor WhatsApp pelanggan tidak ditemukan', 'error');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '').replace(/^0/, '62');
    const remainingAmount = Math.max(0, Number(task.order.totalAmount) - Number(task.order.paidAmount));
    const codText =
      task.order.paymentStatus === 'PAID'
        ? 'Status: LUNAS (bebas tagihan)'
        : `Sisa Tagihan COD: Rp ${remainingAmount.toLocaleString('id-ID')}`;

    const text = encodeURIComponent(
      `Halo Kak ${task.order.customer?.name || ''}, kami dari ${activeOutlet?.name || 'Well POS Laundry'}.\n\n` +
      `🛵 Pesanan laundry dengan No. Nota: *${task.invoiceNumber}* saat ini *SEDANG DIANTAR* oleh kurir kami (${task.courierName || 'Kurir Toko'}).\n\n` +
      `Alamat Tujuan:\n${task.deliveryAddress || '-'}\n\n` +
      `${codText}\n\n` +
      `Lacak pesanan online: https://wellpos.id/track?invoice=${task.invoiceNumber}\n\n` +
      `Mohon pastikan ada penerima di lokasi. Terima kasih!`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  // Helper Google Maps
  const handleOpenMaps = (address?: string | null) => {
    if (!address) {
      showToast('Alamat pelanggan belum terisi', 'error');
      return;
    }
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
  };

  // ==========================================
  // HANDLERS MANIFEST / WORKSHOP
  // ==========================================
  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleSelectAllOrders = () => {
    if (selectedOrderIds.length === availableOrders.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(availableOrders.map((o) => o.orderId));
    }
  };

  const handleCreateManifestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOutlet?.id || !targetOutletId) {
      showToast('Pilih outlet pengirim dan tujuan yang valid', 'error');
      return;
    }
    if (selectedOrderIds.length === 0) {
      showToast('Pilih minimal 1 nota cucian untuk dimasukkan ke surat jalan', 'error');
      return;
    }

    try {
      setSubmittingManifest(true);
      const payload = {
        sourceOutletId: activeOutlet.id,
        targetOutletId,
        direction,
        driverName: driverName.trim() || undefined,
        vehiclePlate: vehiclePlate.trim() || undefined,
        notes: notes.trim() || undefined,
        orderIds: selectedOrderIds,
      };

      const res = await api.createLaundryManifest(payload);
      if (res.status === 'success') {
        showToast(`Surat jalan ${res.data.manifestNumber} berhasil diterbitkan!`);
        setShowCreateModal(false);
        setDriverName('');
        setVehiclePlate('');
        setNotes('');
        setSelectedOrderIds([]);
        fetchManifests();
        setSelectedManifestForPrint(res.data);
      } else {
        showToast(res.message || 'Gagal membuat surat jalan', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan jaringan saat membuat manifest', 'error');
    } finally {
      setSubmittingManifest(false);
    }
  };

  const handleConfirmReceive = async () => {
    if (!manifestToReceive) return;
    try {
      const res = await api.receiveLaundryManifest(manifestToReceive.id, {
        receivedBy: receiverName.trim() || undefined,
      });
      if (res.status === 'success') {
        showToast(res.message || 'Surat jalan berhasil dikonfirmasi diterima!');
        setManifestToReceive(null);
        setReceiverName('');
        fetchManifests();
      } else {
        showToast(res.message || 'Gagal mengonfirmasi penerimaan', 'error');
      }
    } catch {
      showToast('Terjadi gangguan jaringan saat konfirmasi penerimaan', 'error');
    }
  };

  const filteredManifests = manifests.filter((m) => {
    if (workshopTabFilter !== 'ALL' && m.direction !== workshopTabFilter) return false;
    if (workshopSearchQuery.trim()) {
      const query = workshopSearchQuery.toLowerCase();
      const matchNumber = m.manifestNumber.toLowerCase().includes(query);
      const matchDriver = m.driverName?.toLowerCase().includes(query);
      const matchVehicle = m.vehiclePlate?.toLowerCase().includes(query);
      const matchSource = m.sourceOutlet?.name.toLowerCase().includes(query);
      const matchTarget = m.targetOutlet?.name.toLowerCase().includes(query);
      return matchNumber || matchDriver || matchVehicle || matchSource || matchTarget;
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fadeIn">
      {/* Header Halaman Utama */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-900 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                Delivery &amp; Antar-Jemput
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Kelola penjemputan, pengantaran cucian ke pelanggan, tarif ongkir, dan pelunasan COD
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeOutlet && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-bold text-slate-700">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Toko: {activeOutlet.name}</span>
            </div>
          )}

          {activeMainTab === 'DELIVERY' ? (
            <button
              type="button"
              onClick={() => {
                if (deliveryConfig) setConfigDraft(deliveryConfig);
                setShowConfigModal(true);
              }}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Settings className="w-4 h-4 text-slate-600" />
              <span>Atur Tarif &amp; Zona</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Surat Jalan</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tab Navigation (Tab 1: Delivery Pelanggan, Tab 2: Transfer Workshop) */}
      {hasMultipleOutletsOrManifests && (
        <div className="flex border-b border-slate-200 gap-2">
          <button
            type="button"
            onClick={() => setActiveMainTab('DELIVERY')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeMainTab === 'DELIVERY'
                ? 'border-blue-900 text-blue-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Delivery Pelanggan</span>
            {(deliveryKpis.pendingPickup > 0 || deliveryKpis.readyToDeliver > 0) && (
              <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-900 text-[10px] font-black">
                {deliveryKpis.pendingPickup + deliveryKpis.readyToDeliver}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('WORKSHOP')}
            className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeMainTab === 'WORKSHOP'
                ? 'border-blue-900 text-blue-900 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Transfer Workshop / Surat Jalan</span>
            {manifests.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-black">
                {manifests.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ==================================================== */}
      {/* TAMPILAN TAB 1: DELIVERY PELANGGAN                   */}
      {/* ==================================================== */}
      {activeMainTab === 'DELIVERY' && (
        <div className="space-y-5 animate-fadeIn">
          {/* KPI Dashboard Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                Perlu Dijemput
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{deliveryKpis.pendingPickup}</span>
                <span className="text-[10px] font-semibold text-slate-400">Tugas</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider block">
                Siap Diantar
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-black text-slate-900">{deliveryKpis.readyToDeliver}</span>
                <span className="text-[10px] font-semibold text-slate-400">Siap</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider block">
                Sedang Diantar
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-black text-blue-900">{deliveryKpis.outForDelivery}</span>
                <span className="text-[10px] font-semibold text-slate-400">OTW</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                Selesai Hari Ini
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-2xl font-black text-emerald-700">{deliveryKpis.deliveredToday}</span>
                <span className="text-[10px] font-semibold text-slate-400">Selesai</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-rose-200/80 bg-rose-50/20 shadow-xs col-span-2 lg:col-span-1">
              <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block">
                Tagihan COD Aktif
              </span>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-lg font-black text-rose-700">
                  Rp {deliveryKpis.totalCodRemaining.toLocaleString('id-ID')}
                </span>
                <span className="text-[10px] font-bold text-rose-600">Piutang</span>
              </div>
            </div>
          </div>

          {/* Filter Toolbar & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs">
            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {[
                { key: 'ALL', label: 'Semua' },
                { key: 'PENDING_PICKUP', label: 'Perlu Dijemput' },
                { key: 'READY_TO_DELIVER', label: 'Siap Diantar' },
                { key: 'OUT_FOR_DELIVERY', label: 'Sedang Diantar' },
                { key: 'DELIVERED', label: 'Selesai' },
              ].map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setDeliveryFilter(pill.key as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    deliveryFilter === pill.key
                      ? 'bg-blue-900 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={deliverySearch}
                onChange={(e) => setDeliverySearch(e.target.value)}
                placeholder="Cari nota, pelanggan, alamat, kurir..."
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-900 transition-colors"
              />
            </div>
          </div>

          {/* Task List / Table */}
          {deliveryLoading ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
              <Loader2 className="w-8 h-8 text-blue-900 animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-500">Memuat data pengantaran &amp; penjemputan...</p>
            </div>
          ) : deliveryTasks.length === 0 ? (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <Truck className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Tidak ada tugas delivery</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {deliveryFilter !== 'ALL' || deliverySearch
                  ? 'Tidak ada pesanan yang sesuai dengan filter atau kata kunci pencarian.'
                  : 'Pesanan laundry dengan opsi Jemput / Antar akan muncul di sini secara otomatis.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {deliveryTasks.map((task) => {
                const remaining = Math.max(0, Number(task.order.totalAmount) - Number(task.order.paidAmount));
                const isPaid = task.order.paymentStatus === 'PAID' || remaining === 0;

                const getStatusBadge = () => {
                  switch (task.deliveryStatus) {
                    case 'PENDING_PICKUP':
                      return <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">Menunggu Penjemputan</span>;
                    case 'PICKED_UP':
                      return <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800">Sudah Dijemput</span>;
                    case 'READY_TO_DELIVER':
                      return <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-800">Siap Diantar</span>;
                    case 'OUT_FOR_DELIVERY':
                      return <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-900 animate-pulse">🛵 OTW ke Pelanggan</span>;
                    case 'DELIVERED':
                      return <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">✓ Sudah Diterima</span>;
                    default:
                      return <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{task.deliveryStatus || 'Proses'}</span>;
                  }
                };

                const getTypeLabel = () => {
                  switch (task.deliveryType) {
                    case 'PICKUP_ONLY':
                      return 'Jemput Saja';
                    case 'DELIVERY_ONLY':
                      return 'Antar Saja';
                    case 'PICKUP_AND_DELIVERY':
                      return 'Jemput & Antar';
                    default:
                      return 'Antar Pelanggan';
                  }
                };

                return (
                  <div
                    key={task.id}
                    className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all space-y-3.5"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-xs font-black text-blue-900 bg-blue-50 px-2.5 py-1 rounded-lg">
                          {task.invoiceNumber}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          {task.order.customer?.name || 'Pelanggan Walk-in'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600">
                          {getTypeLabel()}
                        </span>
                        {getStatusBadge()}
                      </div>

                      <div className="flex items-center gap-2">
                        {isPaid ? (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                            ✓ LUNAS
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                            COD: Rp {remaining.toLocaleString('id-ID')}
                          </span>
                        )}
                        {task.deliveryFee > 0 && (
                          <span className="text-[11px] font-semibold text-slate-500">
                            Ongkir: Rp {task.deliveryFee.toLocaleString('id-ID')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Informasi Alamat, Kurir & Rak */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Alamat Tujuan</span>
                        <p className="font-medium text-slate-700 leading-snug line-clamp-2">
                          {task.deliveryAddress || 'Alamat belum dilengkapi'}
                        </p>
                        {task.deliveryZoneName && (
                          <span className="inline-block text-[10px] text-blue-800 font-bold bg-blue-50 px-2 py-0.5 rounded">
                            Zona: {task.deliveryZoneName}
                          </span>
                        )}
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Status Cucian &amp; Rak</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-800">
                            {task.order.serviceName || 'Layanan Laundry'}
                          </span>
                          {task.order.rackCode && (
                            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-900 font-mono text-[10px] font-black">
                              Rak {task.order.rackCode}
                            </span>
                          )}
                        </div>
                        {task.deliveryNotes && (
                          <p className="text-[11px] text-slate-500 italic">
                            Catatan: {task.deliveryNotes}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Kurir Bertugas</span>
                        <p className="font-bold text-slate-800">
                          {task.courierName || <span className="text-slate-400 font-normal">Belum ditugaskan</span>}
                        </p>
                        {task.courierPhone && (
                          <p className="text-[11px] text-slate-500">{task.courierPhone}</p>
                        )}
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-2">
                        {task.deliveryAddress && (
                          <button
                            type="button"
                            onClick={() => handleOpenMaps(task.deliveryAddress)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <MapPin className="w-3.5 h-3.5 text-blue-900" />
                            <span>Buka Maps</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenWhatsAppKurir(task)}
                          className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5 text-emerald-600" />
                          <span>WA Pelanggan (Kurir OTW)</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        {task.deliveryStatus === 'PENDING_PICKUP' && (
                          <button
                            type="button"
                            onClick={() => {
                              setTaskToDispatch({ task, nextStatus: 'PICKED_UP' });
                              setDispatchCourierName(task.courierName || '');
                              setDispatchCourierPhone(task.courierPhone || '');
                            }}
                            className="px-3.5 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Tugaskan &amp; Jemput Cucian</span>
                          </button>
                        )}

                        {task.deliveryStatus === 'READY_TO_DELIVER' && (
                          <button
                            type="button"
                            onClick={() => {
                              setTaskToDispatch({ task, nextStatus: 'OUT_FOR_DELIVERY' });
                              setDispatchCourierName(task.courierName || '');
                              setDispatchCourierPhone(task.courierPhone || '');
                            }}
                            className="px-3.5 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>Mulai Pengantaran</span>
                          </button>
                        )}

                        {task.deliveryStatus === 'OUT_FOR_DELIVERY' && (
                          <button
                            type="button"
                            onClick={() => {
                              setTaskToComplete(task);
                              setCompleteCourierName(task.courierName || '');
                              setCollectCodPayment(!isPaid);
                              setProofPhotoFile(null);
                              setProofPhotoPreview(null);
                            }}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Konfirmasi Selesai &amp; COD</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================== */}
      {/* TAMPILAN TAB 2: TRANSFER WORKSHOP & MANIFEST        */}
      {/* ==================================================== */}
      {activeMainTab === 'WORKSHOP' && hasMultipleOutletsOrManifests && (
        <div className="space-y-6 animate-fadeIn">
          {/* Toolbar Pencarian & Tab Filter Workshop */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setWorkshopTabFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  workshopTabFilter === 'ALL'
                    ? 'bg-blue-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Surat Jalan
              </button>
              <button
                type="button"
                onClick={() => setWorkshopTabFilter('TO_WORKSHOP')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  workshopTabFilter === 'TO_WORKSHOP'
                    ? 'bg-blue-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kirim ke Workshop (Cucian Kotor)
              </button>
              <button
                type="button"
                onClick={() => setWorkshopTabFilter('TO_OUTLET')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  workshopTabFilter === 'TO_OUTLET'
                    ? 'bg-blue-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kirim ke Outlet (Cucian Bersih)
              </button>
            </div>

            <div className="relative min-w-[260px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari no. manifest, driver, outlet..."
                value={workshopSearchQuery}
                onChange={(e) => setWorkshopSearchQuery(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2 text-xs font-medium rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-blue-900 shadow-2xs"
              />
            </div>
          </div>

          {/* Tabel / Kartu Daftar Manifest Surat Jalan */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            {manifestLoading ? (
              <div className="p-12 text-center text-xs text-slate-500 font-medium">
                <Loader2 className="w-8 h-8 text-blue-900 animate-spin mx-auto mb-2" />
                Memuat data surat jalan workshop...
              </div>
            ) : filteredManifests.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Belum ada surat jalan transfer</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {workshopSearchQuery
                    ? 'Tidak ada manifest surat jalan yang cocok dengan kata kunci pencarian.'
                    : 'Gunakan tombol Buat Surat Jalan untuk mengirim cucian kotor ke workshop pusat atau mengembalikan cucian bersih ke outlet.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">No. Manifest</th>
                      <th className="py-3 px-4">Arah Transfer</th>
                      <th className="py-3 px-4">Pengirim &rarr; Penerima</th>
                      <th className="py-3 px-4">Muatan Cucian</th>
                      <th className="py-3 px-4">Driver &amp; Armada</th>
                      <th className="py-3 px-4">Status &amp; Waktu</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredManifests.map((m) => {
                      const isPendingReceive = m.status === 'DISPATCHED';
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-blue-900">
                            {m.manifestNumber}
                          </td>
                          <td className="py-3.5 px-4">
                            {m.direction === 'TO_WORKSHOP' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-purple-100 text-purple-900">
                                Ke Workshop
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900">
                                Kembali ke Toko
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                              <span>{m.sourceOutlet?.name || 'Toko Asal'}</span>
                              <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="text-blue-900">{m.targetOutlet?.name || 'Tujuan'}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-800">
                              {m.totalOrdersCount || m.totalOrders || 0} Nota
                            </span>
                            <span className="text-slate-400 block text-[10px]">
                              {m.totalWeightKg
                                ? `${Number(m.totalWeightKg).toFixed(1)} Kg`
                                : `${m.totalPieces || m.totalOrdersCount || 0} Pcs`}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="text-slate-800 font-semibold">{m.driverName || '-'}</span>
                            {m.vehiclePlate && (
                              <span className="text-slate-400 block text-[10px] font-mono">{m.vehiclePlate}</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {m.status === 'RECEIVED' ? (
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 className="w-2.5 h-2.5" />
                                  <span>Diterima</span>
                                </span>
                                {m.receivedBy && (
                                  <span className="text-[10px] text-slate-400 block mt-0.5">
                                    Oleh: {m.receivedBy}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800">
                                <Clock className="w-2.5 h-2.5" />
                                <span>Dalam Perjalanan</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {isPendingReceive && (
                                <button
                                  type="button"
                                  onClick={() => setManifestToReceive(m)}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                                >
                                  <PackageCheck className="w-3.5 h-3.5" />
                                  <span>Konfirmasi Terima</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setSelectedManifestForPrint(m)}
                                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                                title="Cetak Surat Jalan Resmi"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 1: ATUR TARIF & ZONA DELIVERY                 */}
      {/* ==================================================== */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-xl w-full max-h-[92dvh] sm:max-h-[90vh] shadow-2xl flex flex-col min-h-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-blue-900" />
                <h3 className="font-black text-slate-900 text-sm">Konfigurasi Tarif &amp; Zona Delivery</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 overflow-y-auto overscroll-contain flex-1 space-y-4 text-xs">
                {/* Toggle Enable Delivery */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="font-bold text-slate-800 block">Aktifkan Layanan Antar-Jemput</span>
                    <span className="text-[11px] text-slate-500">
                      Tampilkan pilihan delivery di kasir dan form drop-off
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={configDraft.enabled}
                    onChange={(e) => setConfigDraft({ ...configDraft, enabled: e.target.checked })}
                    className="w-4 h-4 text-blue-900 rounded cursor-pointer"
                  />
                </div>

                {/* Gratis Ongkir Thresholds */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Gratis Ongkir Min. Belanja (Rp)
                    </label>
                    <input
                      type="number"
                      value={configDraft.freeDeliveryMinAmount}
                      onChange={(e) =>
                        setConfigDraft({ ...configDraft, freeDeliveryMinAmount: Number(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:border-blue-900"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Gratis Ongkir Min. Berat (Kg)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={configDraft.freeDeliveryMinWeightKg}
                      onChange={(e) =>
                        setConfigDraft({ ...configDraft, freeDeliveryMinWeightKg: Number(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:border-blue-900"
                    />
                  </div>
                </div>

                {/* Pengali Bolak-Balik */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Pengali Tarif Jemput &amp; Antar (Bolak-Balik)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={configDraft.roundTripMultiplier}
                    onChange={(e) =>
                      setConfigDraft({ ...configDraft, roundTripMultiplier: Number(e.target.value) || 1.8 })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-xs focus:outline-none focus:border-blue-900"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Default 1.8x (Diskon paket hemat jemput dan antar sekaligus dibanding 2x tarif flat)
                  </p>
                </div>

                {/* Daftar Zona Tarif */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">Daftar Zona &amp; Tarif Ongkir</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newZone: LaundryDeliveryZone = {
                          id: `zone_${Date.now()}`,
                          name: `Zona Baru ${configDraft.zones.length + 1}`,
                          fee: 10000,
                          isActive: true,
                          estimatedDeliveryTime: '30-60 Menit',
                        };
                        setConfigDraft({ ...configDraft, zones: [...configDraft.zones, newZone] });
                      }}
                      className="px-2.5 py-1 bg-blue-50 text-blue-900 rounded-lg text-xs font-bold hover:bg-blue-100 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Zona</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {configDraft.zones.map((zone, idx) => (
                      <div
                        key={zone.id || idx}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={zone.name}
                            placeholder="Nama Zona (cth: Radius 0-3 Km)"
                            onChange={(e) => {
                              const updated = [...configDraft.zones];
                              updated[idx].name = e.target.value;
                              setConfigDraft({ ...configDraft, zones: updated });
                            }}
                            className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold"
                          />
                          <input
                            type="number"
                            value={zone.fee}
                            placeholder="Tarif (Rp)"
                            onChange={(e) => {
                              const updated = [...configDraft.zones];
                              updated[idx].fee = Number(e.target.value) || 0;
                              setConfigDraft({ ...configDraft, zones: updated });
                            }}
                            className="w-28 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = configDraft.zones.filter((_, i) => i !== idx);
                              setConfigDraft({ ...configDraft, zones: updated });
                            }}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="px-5 py-2 text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Simpan Tarif</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 2: TUGASKAN KURIR (JEMPUT / ANTAR)             */}
      {/* ==================================================== */}
      {taskToDispatch && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-900" />
                <h3 className="font-black text-slate-900 text-sm">
                  {taskToDispatch.nextStatus === 'PICKED_UP' ? 'Tugaskan Kurir Penjemputan' : 'Mulai Pengantaran ke Pelanggan'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setTaskToDispatch(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDispatchCourierSubmit} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-mono text-xs font-black text-blue-900">{taskToDispatch.task.invoiceNumber}</span>
                <p className="font-bold text-slate-800">{taskToDispatch.task.order.customer?.name}</p>
                <p className="text-slate-500 text-[11px]">{taskToDispatch.task.deliveryAddress}</p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Kurir Bertugas</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi (Kurir Toko)"
                  value={dispatchCourierName}
                  onChange={(e) => setDispatchCourierName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-900"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">No. HP / WA Kurir (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: 08123456789"
                  value={dispatchCourierPhone}
                  onChange={(e) => setDispatchCourierPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:border-blue-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTaskToDispatch(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingDispatch}
                  className="px-5 py-2 text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingDispatch ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Konfirmasi Kurir Berangkat</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 3: SELESAI PENGANTARAN & PELUNASAN COD        */}
      {/* ==================================================== */}
      {taskToComplete && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92dvh] sm:max-h-[90vh] shadow-2xl flex flex-col min-h-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <h3 className="font-black text-slate-900 text-sm">Konfirmasi Pengantaran Selesai &amp; COD</h3>
              </div>
              <button
                type="button"
                onClick={() => setTaskToComplete(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCompleteDeliverySubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 overflow-y-auto overscroll-contain flex-1 space-y-4 text-xs">
                {/* Rincian Nota & Status Piutang */}
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-black text-blue-900">{taskToComplete.invoiceNumber}</span>
                    <span className="font-bold text-slate-800">{taskToComplete.order.customer?.name}</span>
                  </div>
                  <p className="text-slate-600 text-[11px]">{taskToComplete.deliveryAddress}</p>
                </div>

                {/* Pelunasan COD Checkbox & Pilihan Metode */}
                {taskToComplete.order.paymentStatus !== 'PAID' ? (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={collectCodPayment}
                        onChange={(e) => setCollectCodPayment(e.target.checked)}
                        className="w-4 h-4 text-blue-900 rounded mt-0.5 cursor-pointer"
                      />
                      <div>
                        <span className="font-black text-amber-900 block text-xs">
                          Terima Pelunasan COD Sekarang
                        </span>
                        <span className="text-[11px] text-amber-800">
                          Sisa Tagihan: Rp{' '}
                          {Math.max(
                            0,
                            Number(taskToComplete.order.totalAmount) - Number(taskToComplete.order.paidAmount)
                          ).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </label>

                    {collectCodPayment && (
                      <div className="space-y-1.5 pt-2 border-t border-amber-200/60">
                        <label className="font-bold text-amber-900 block">Metode Pembayaran COD</label>
                        <div className="relative">
                          <select
                            value={codPaymentMethod}
                            onChange={(e) => setCodPaymentMethod(e.target.value as any)}
                            className="w-full appearance-none pr-10 pl-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-900"
                          >
                            <option value="CASH">Tunai (Cash ke Kurir)</option>
                            <option value="QRIS">QRIS / Non-Tunai</option>
                            <option value="TRANSFER">Transfer Bank</option>
                          </select>
                          <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Pesanan ini sudah LUNAS sebelumnya.</span>
                  </div>
                )}

                {/* Upload Foto Bukti Pengantaran */}
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-700 block">Foto Bukti Pengantaran (Opsional)</label>
                  <div className="flex items-center gap-3">
                    <label className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer transition-colors">
                      <Camera className="w-4 h-4 text-slate-500" />
                      <span>Pilih / Ambil Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleProofFileChange}
                        className="hidden"
                      />
                    </label>
                    {proofPhotoPreview && (
                      <div className="relative w-12 h-12 rounded-xl overflow-hidden border border-slate-300 shadow-2xs">
                        <img src={proofPhotoPreview} alt="Bukti" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setProofPhotoFile(null);
                            setProofPhotoPreview(null);
                          }}
                          className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Catatan Selesai */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Catatan Tambahan (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Diterima oleh Mbak Siti (asisten rumah)"
                    value={completeNotes}
                    onChange={(e) => setCompleteNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-900"
                  />
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setTaskToComplete(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingComplete || uploadingProof}
                  className="px-5 py-2 text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingComplete || uploadingProof ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Konfirmasi Selesai &amp; Pelunasan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 4: BUAT MANIFEST WORKSHOP                      */}
      {/* ==================================================== */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full max-h-[92dvh] sm:max-h-[90vh] shadow-2xl flex flex-col min-h-0 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-900" />
                <h3 className="font-black text-slate-900 text-sm">Buat Surat Jalan Manifest Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateManifestSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-5 overflow-y-auto overscroll-contain flex-1 space-y-4 text-xs">
                {/* Pilihan Arah Transfer */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Arah Pengiriman</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDirection('TO_WORKSHOP')}
                      className={`p-3 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                        direction === 'TO_WORKSHOP'
                          ? 'border-purple-600 bg-purple-50 text-purple-950'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block text-xs">Ke Workshop</span>
                      <span className="text-[10px] font-normal text-slate-500">Kirim cucian kotor untuk dicuci/setrika</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDirection('TO_OUTLET')}
                      className={`p-3 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                        direction === 'TO_OUTLET'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block text-xs">Kembali ke Outlet</span>
                      <span className="text-[10px] font-normal text-slate-500">Kirim cucian bersih siap diambil pelanggan</span>
                    </button>
                  </div>
                </div>

                {/* Pilih Outlet Tujuan */}
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Outlet / Workshop Tujuan</label>
                  <div className="relative">
                    <select
                      value={targetOutletId}
                      onChange={(e) => setTargetOutletId(e.target.value)}
                      className="w-full appearance-none pr-10 pl-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-900"
                    >
                      <option value="">-- Pilih Outlet / Workshop Tujuan --</option>
                      {workshops
                        .filter((w) => w.id !== activeOutlet?.id)
                        .map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name} {w.isWorkshop ? '(Mode Workshop)' : '(Outlet Toko)'}
                          </option>
                        ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Driver & Kendaraan */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Nama Driver / Staf Pembawa</label>
                    <input
                      type="text"
                      placeholder="Contoh: Pak Joko"
                      value={driverName}
                      onChange={(e) => setDriverName(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-900"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Plat Nomor / Kendaraan</label>
                    <input
                      type="text"
                      placeholder="Contoh: B 1234 XYZ (Motor Box)"
                      value={vehiclePlate}
                      onChange={(e) => setVehiclePlate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium focus:outline-none focus:border-blue-900"
                    />
                  </div>
                </div>

                {/* Daftar Cucian Siap Kirim */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800">
                      Pilih Cucian untuk Dimasukkan ({selectedOrderIds.length}/{availableOrders.length} terpilih)
                    </label>
                    {availableOrders.length > 0 && (
                      <button
                        type="button"
                        onClick={toggleSelectAllOrders}
                        className="text-[11px] font-bold text-blue-900 hover:underline cursor-pointer"
                      >
                        {selectedOrderIds.length === availableOrders.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
                      </button>
                    )}
                  </div>

                  {loadingOrders ? (
                    <div className="p-8 text-center text-slate-400">
                      <Loader2 className="w-5 h-5 animate-spin mx-auto mb-1 text-blue-900" />
                      Memuat daftar cucian siap kirim...
                    </div>
                  ) : availableOrders.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500">
                      Tidak ada cucian yang siap ditransfer untuk arah ini saat ini.
                    </div>
                  ) : (
                    <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                      {availableOrders.map((ord) => (
                        <label
                          key={ord.orderId}
                          className="flex items-center gap-3 p-2.5 hover:bg-slate-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.includes(ord.orderId)}
                            onChange={() => toggleSelectOrder(ord.orderId)}
                            className="w-4 h-4 text-blue-900 rounded cursor-pointer"
                          />
                          <div className="flex-1 flex items-center justify-between">
                            <div>
                              <span className="font-mono font-bold text-blue-900 mr-2">{ord.invoiceNumber}</span>
                              <span className="font-semibold text-slate-800">{ord.customerName}</span>
                              <span className="text-slate-400 block text-[10px]">{ord.serviceName}</span>
                            </div>
                            <span className="font-mono text-xs font-bold text-slate-700">
                              {ord.totalWeightKg ? `${ord.totalWeightKg} Kg` : `${ord.totalPieces} Pcs`}
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingManifest || selectedOrderIds.length === 0}
                  className="px-5 py-2 text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {submittingManifest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  <span>Terbitkan Surat Jalan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 5: KONFIRMASI TERIMA MANIFEST WORKSHOP        */}
      {/* ==================================================== */}
      {manifestToReceive && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-md w-full shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-emerald-600" />
                <h3 className="font-black text-slate-900 text-sm">Konfirmasi Penerimaan Surat Jalan</h3>
              </div>
              <button
                type="button"
                onClick={() => setManifestToReceive(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="font-mono text-xs font-black text-blue-900">{manifestToReceive.manifestNumber}</span>
                <p className="font-semibold text-slate-800">
                  Total Muatan: {manifestToReceive.totalOrdersCount || manifestToReceive.totalOrders || 0} Nota (
                  {manifestToReceive.totalWeightKg
                    ? `${Number(manifestToReceive.totalWeightKg).toFixed(1)} Kg`
                    : `${manifestToReceive.totalPieces || manifestToReceive.totalOrdersCount || 0} Pcs`}
                  )
                </p>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Nama Petugas / Kasir Penerima</label>
                <input
                  type="text"
                  placeholder="Contoh: Rina (Staf Penerima)"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:border-blue-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setManifestToReceive(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReceive}
                  className="px-5 py-2 text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Konfirmasi Diterima Lengkap</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL 6: CETAK SURAT JALAN RESMI                    */}
      {/* ==================================================== */}
      {selectedManifestForPrint && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] shadow-2xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-900" />
                <h3 className="font-black text-slate-900 text-sm">Pratinjau Surat Jalan Resmi</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedManifestForPrint(null)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 font-mono text-xs text-slate-800 space-y-4 bg-slate-50/50">
              <div className="border border-slate-300 bg-white p-6 shadow-sm space-y-4">
                <div className="text-center border-b pb-4">
                  <h2 className="font-black text-base uppercase tracking-wider text-slate-900">
                    SURAT JALAN TRANSFER WORKSHOP
                  </h2>
                  <p className="text-slate-500 text-[11px] font-sans">
                    {activeOutlet?.name || 'WELL POS LAUNDRY SYSTEM'}
                  </p>
                  <p className="font-bold text-sm text-blue-900 mt-1">{selectedManifestForPrint.manifestNumber}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-[11px] border-b pb-4">
                  <div>
                    <span className="text-slate-400 block">Outlet Pengirim:</span>
                    <strong className="text-slate-900">{selectedManifestForPrint.sourceOutlet?.name}</strong>
                    <span className="text-slate-400 block mt-2">Driver / Staf:</span>
                    <strong className="text-slate-900">
                      {selectedManifestForPrint.driverName || '-'} ({selectedManifestForPrint.vehiclePlate || '-'})
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Outlet Tujuan:</span>
                    <strong className="text-slate-900">{selectedManifestForPrint.targetOutlet?.name}</strong>
                    <span className="text-slate-400 block mt-2">Tanggal Berangkat:</span>
                    <strong className="text-slate-900">
                      {new Date(selectedManifestForPrint.createdAt).toLocaleString('id-ID')}
                    </strong>
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="font-bold block uppercase text-[10px] tracking-wider text-slate-500">
                    Rincian Nota Cucian yang Dibawa:
                  </span>
                  <div className="border border-slate-200 divide-y divide-slate-100 text-[11px]">
                    {selectedManifestForPrint.items?.map((it: any, idx: number) => (
                      <div key={idx} className="p-2 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-blue-900 mr-2">{it.order?.invoiceNumber}</span>
                          <span className="text-slate-800">{it.order?.customer?.name || 'Pelanggan'}</span>
                        </div>
                        <span className="font-semibold text-slate-600">
                          {it.order?.laundryDetail?.totalWeightKg
                            ? `${it.order.laundryDetail.totalWeightKg} Kg`
                            : `${it.order?.laundryDetail?.totalPieces || 1} Pcs`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 pt-8 text-center text-[11px]">
                  <div className="space-y-12">
                    <p className="font-semibold text-slate-600">Diserahkan Oleh (Driver/Staf Asal)</p>
                    <p className="font-bold underline text-slate-800">
                      ( {selectedManifestForPrint.driverName || 'Staf Pengirim'} )
                    </p>
                  </div>
                  <div className="space-y-12">
                    <p className="font-semibold text-slate-600">Diterima Oleh (Staf Workshop/Toko)</p>
                    <p className="font-bold underline text-slate-800">
                      ( {selectedManifestForPrint.receivedBy || '................................'} )
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedManifestForPrint(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Tutup
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 text-xs font-bold bg-blue-900 hover:bg-blue-800 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Dokumen</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Feedback Toast */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold animate-fadeIn transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
              : 'bg-rose-950 text-rose-100 border-rose-700'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};
