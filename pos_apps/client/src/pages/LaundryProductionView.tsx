import React, { useState, useEffect, useMemo } from 'react';
import {
  Sparkles,
  Search,
  Filter,
  Waves,
  Flame,
  Package,
  CheckCircle2,
  AlertTriangle,
  Check,
  Shield,
  Clock,
  QrCode,
  AlertOctagon,
  RotateCcw,
  Archive,
  Wrench,
  Plus,
  Trash2,
  Edit2,
  X,
  Loader2,
  ChevronDown,
  ShieldAlert,
  Layers,
  Tag,
} from 'lucide-react';
import type { Outlet } from '../types/outlet';
import { api, authStorage } from '../services/api';
import type { LaundryQueueOrder, ProductionStageDefinition, LaundryMachine } from '../types/laundry';
import { DEFAULT_PRODUCTION_STAGES } from '../types/laundry';
import { LaundrySortingModal } from '../components/LaundrySortingModal';
import { LaundryBarcodeScannerModal } from '../components/laundry/LaundryBarcodeScannerModal';
import { LaundryRewashModal } from '../components/laundry/LaundryRewashModal';
import { LaundryIncidentModal } from '../components/laundry/LaundryIncidentModal';
import { LaundryIncidentManagementModal } from '../components/laundry/LaundryIncidentManagementModal';
import { LaundryBatchBoardModal } from '../components/laundry/LaundryBatchBoardModal';
import { LaundryTagScannerModal } from '../components/laundry/LaundryTagScannerModal';
import { LaundryItemTrackingModal } from '../components/laundry/LaundryItemTrackingModal';
import { SmartProductionQueuePanel } from '../components/laundry/SmartProductionQueuePanel';
import { useDialog } from '../context/DialogContext';

interface LaundryProductionViewProps {
  activeOutlet: Outlet | null;
}

type StationFilter = 'ALL' | 'SORTING' | 'WASHING_DRYING' | 'IRONING_FOLDING' | 'PACKING_RACK';
type SlaFilter = 'ALL' | 'DUE_TODAY' | 'OVERDUE';

export const LaundryProductionView: React.FC<LaundryProductionViewProps> = ({ activeOutlet }) => {
  const dialog = useDialog();
  const [orders, setOrders] = useState<LaundryQueueOrder[]>([]);
  const [stages, setStages] = useState<ProductionStageDefinition[]>(DEFAULT_PRODUCTION_STAGES);
  const [loading, setLoading] = useState(true);
  const [activeStation, setActiveStation] = useState<StationFilter>('ALL');
  const [slaFilter, setSlaFilter] = useState<SlaFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrderForSorting, setSelectedOrderForSorting] = useState<LaundryQueueOrder | null>(null);
  const [selectedOrderForRewash, setSelectedOrderForRewash] = useState<LaundryQueueOrder | null>(null);
  const [rewashModalOpen, setRewashModalOpen] = useState(false);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [selectedMachines, setSelectedMachines] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [selectedOrderForIncident, setSelectedOrderForIncident] = useState<LaundryQueueOrder | null>(null);
  const [incidentModalOpen, setIncidentModalOpen] = useState(false);
  const [incidentManagementOpen, setIncidentManagementOpen] = useState(false);

  // Core Phase 2 State
  const [productionViewTab, setProductionViewTab] = useState<'STATION' | 'PRIORITY_QUEUE'>('STATION');
  const [batchBoardModalOpen, setBatchBoardModalOpen] = useState(false);
  const [tagScannerModalOpen, setTagScannerModalOpen] = useState(false);
  const [itemTrackingModalOpen, setItemTrackingModalOpen] = useState(false);
  const [selectedOrderForTracking, setSelectedOrderForTracking] = useState<{
    id: string;
    invoiceNumber: string;
    customerName?: string;
  } | null>(null);
  const [selectedBatchOrderIds, setSelectedBatchOrderIds] = useState<string[]>([]);

  // Master Mesin (Washer / Dryer)
  const [machines, setMachines] = useState<LaundryMachine[]>([]);
  const [loadingMachines, setLoadingMachines] = useState(false);
  const [manageMachinesModalOpen, setManageMachinesModalOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<LaundryMachine | null>(null);
  const [machineFormCode, setMachineFormCode] = useState('');
  const [machineFormName, setMachineFormName] = useState('');
  const [machineFormType, setMachineFormType] = useState<'WASHER' | 'DRYER'>('WASHER');
  const [machineFormCapacity, setMachineFormCapacity] = useState('10');
  const [machineFormStatus, setMachineFormStatus] = useState<'ACTIVE' | 'MAINTENANCE' | 'INACTIVE'>('ACTIVE');
  const [savingMachine, setSavingMachine] = useState(false);

  const currentUser = authStorage.getUser();
  const canManageMachines = Boolean(
    currentUser && ['OWNER', 'ADMIN', 'SUPERVISOR'].includes(currentUser.role)
  );

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 3000);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [ordersRes, stagesRes, machinesRes] = await Promise.all([
        api.getLaundryOrders(activeOutlet?.id),
        api.getLaundryStageSettings ? api.getLaundryStageSettings().catch(() => null) : Promise.resolve(null),
        api.getLaundryMachines(activeOutlet?.id).catch(() => null),
      ]);

      if (ordersRes.status === 'success' && Array.isArray(ordersRes.data)) {
        setOrders(ordersRes.data);
      }
      if (stagesRes && stagesRes.status === 'success' && Array.isArray(stagesRes.data)) {
        setStages(stagesRes.data);
      }
      if (machinesRes && machinesRes.status === 'success' && Array.isArray(machinesRes.data)) {
        setMachines(machinesRes.data);
      }
    } catch (err: any) {
      console.error('Error fetching production data:', err);
    } finally {
      setLoading(false);
    }
  };

  const refreshMachines = async () => {
    try {
      setLoadingMachines(true);
      const res = await api.getLaundryMachines(activeOutlet?.id);
      if (res.status === 'success' && Array.isArray(res.data)) {
        setMachines(res.data);
      }
    } catch {
      // Ignore
    } finally {
      setLoadingMachines(false);
    }
  };

  const handleSaveMachine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machineFormCode.trim() || !machineFormName.trim()) {
      dialog.toast('Kode dan nama mesin wajib diisi', 'error');
      return;
    }
    setSavingMachine(true);
    try {
      if (editingMachine) {
        const res = await api.updateLaundryMachine(editingMachine.id, {
          name: machineFormName.trim(),
          machineType: machineFormType,
          capacityKg: parseFloat(machineFormCapacity) || 10,
          status: machineFormStatus,
        });
        if (res.status === 'success') {
          showToast(`Mesin ${machineFormCode} berhasil diperbarui!`);
          refreshMachines();
          setEditingMachine(null);
          setMachineFormCode('');
          setMachineFormName('');
        } else {
          dialog.toast(res.message || 'Gagal memperbarui mesin', 'error');
        }
      } else {
        const res = await api.createLaundryMachine({
          outletId: activeOutlet?.id,
          code: machineFormCode.trim().toUpperCase(),
          name: machineFormName.trim(),
          machineType: machineFormType,
          capacityKg: parseFloat(machineFormCapacity) || 10,
          status: machineFormStatus,
        });
        if (res.status === 'success') {
          showToast(`Mesin baru ${machineFormCode} berhasil ditambahkan!`);
          refreshMachines();
          setMachineFormCode('');
          setMachineFormName('');
        } else {
          dialog.toast(res.message || 'Gagal menambahkan mesin', 'error');
        }
      }
    } catch (err: any) {
      dialog.toast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setSavingMachine(false);
    }
  };

  const handleToggleMachineStatus = async (machine: LaundryMachine) => {
    const nextStatus = machine.status === 'ACTIVE' ? 'MAINTENANCE' : 'ACTIVE';
    try {
      const res = await api.updateLaundryMachine(machine.id, { status: nextStatus });
      if (res.status === 'success') {
        showToast(`Status mesin ${machine.code} diubah menjadi ${nextStatus === 'ACTIVE' ? 'Aktif' : 'Maintenance'}`);
        refreshMachines();
      }
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal mengubah status mesin', 'error');
    }
  };

  const handleDeleteMachine = async (machine: LaundryMachine) => {
    const confirmed = await dialog.confirm({
      title: 'Hapus Mesin',
      message: `Yakin ingin menghapus mesin ${machine.code} (${machine.name})?`,
      variant: 'danger',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
    });
    if (!confirmed) return;
    try {
      const res = await api.deleteLaundryMachine(machine.id);
      if (res.status === 'success') {
        showToast(`Mesin ${machine.code} berhasil dihapus`);
        refreshMachines();
      }
    } catch (err: any) {
      dialog.toast(err.message || 'Gagal menghapus mesin', 'error');
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeOutlet?.id]);

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

  // Statistik SLA
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

  // Filter Antrean Berdasarkan Stasiun Kerja, SLA & Pencarian
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (order.status === 'COMPLETED') return false;

      // Filter SLA
      if (slaFilter !== 'ALL') {
        const sla = getSlaStatus(order);
        if (slaFilter === 'OVERDUE' && sla !== 'OVERDUE') return false;
        if (slaFilter === 'DUE_TODAY' && sla !== 'DUE_TODAY') return false;
      }

      // Filter Pencarian
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesInv = order.invoiceNumber.toLowerCase().includes(q);
        const matchesCust = order.customerName.toLowerCase().includes(q);
        const matchesSrv = order.serviceName.toLowerCase().includes(q);
        if (!matchesInv && !matchesCust && !matchesSrv) return false;
      }

      const stage = (order.currentStage || 'DROP_OFF').toUpperCase();

      if (activeStation === 'SORTING') {
        return stage === 'DROP_OFF' || stage === 'TAGGING' || stage === 'LABEL' || stage === 'SORTING' || stage === 'SORTIR';
      }
      if (activeStation === 'WASHING_DRYING') {
        return stage === 'WASHING' || stage === 'CUCI' || stage === 'DRYING' || stage === 'KERING' || stage === 'CLEANING' || stage === 'SPOTTING';
      }
      if (activeStation === 'IRONING_FOLDING') {
        return stage === 'IRONING' || stage === 'SETRIKA' || stage === 'EXTRA_SETRIKA' || stage === 'FOLDING' || stage === 'LIPAT' || stage === 'DETAILING';
      }
      if (activeStation === 'PACKING_RACK') {
        return stage === 'PACKING' || stage === 'PENGEMASAN' || stage === 'RACK_STORAGE';
      }

      return true;
    });
  }, [orders, activeStation, slaFilter, searchQuery]);

  // Statistik Cepat Stasiun
  const stats = useMemo(() => {
    let sortingCount = 0;
    let washDryCount = 0;
    let ironFoldCount = 0;
    let packRackCount = 0;

    orders.forEach((o) => {
      if (o.status === 'COMPLETED') return;
      const s = (o.currentStage || 'DROP_OFF').toUpperCase();
      if (s === 'DROP_OFF' || s === 'TAGGING' || s === 'LABEL' || s === 'SORTING' || s === 'SORTIR') sortingCount++;
      else if (s === 'WASHING' || s === 'CUCI' || s === 'DRYING' || s === 'KERING' || s === 'CLEANING' || s === 'SPOTTING') washDryCount++;
      else if (s === 'IRONING' || s === 'SETRIKA' || s === 'EXTRA_SETRIKA' || s === 'FOLDING' || s === 'LIPAT' || s === 'DETAILING') ironFoldCount++;
      else if (s === 'PACKING' || s === 'PENGEMASAN' || s === 'RACK_STORAGE') packRackCount++;
    });

    return {
      total: sortingCount + washDryCount + ironFoldCount + packRackCount,
      sortingCount,
      washDryCount,
      ironFoldCount,
      packRackCount,
    };
  }, [orders]);

  // Fungsi Cepat Maju ke Tahap Berikutnya
  const handleQuickAdvance = async (order: LaundryQueueOrder) => {
    const current = (order.currentStage || 'DROP_OFF').toUpperCase();
    if (current === 'RACK_STORAGE' || order.status === 'READY_FOR_PICKUP' || order.status === 'COMPLETED') {
      showToast('Cucian sudah siap di rak kasir outlet dan tidak dapat dimajukan lagi dari workshop', 'error');
      return;
    }

    let nextStage = 'WASHING';

    if (current === 'DROP_OFF' || current === 'TAGGING' || current === 'LABEL') nextStage = 'SORTING';
    else if (current === 'SORTING' || current === 'SORTIR') nextStage = 'WASHING';
    else if (current === 'WASHING' || current === 'CUCI') nextStage = 'DRYING';
    else if (current === 'DRYING' || current === 'KERING') nextStage = 'IRONING';
    else if (current === 'IRONING' || current === 'SETRIKA') nextStage = 'FOLDING';
    else if (current === 'FOLDING' || current === 'LIPAT') nextStage = 'PACKING';
    else if (current === 'PACKING' || current === 'PENGEMASAN') nextStage = 'RACK_STORAGE';
    else return;

    try {
      setAdvancingId(order.id);
      const isWashing = current === 'WASHING' || current === 'CUCI';
      const isDrying = current === 'DRYING' || current === 'KERING';
      const machine = selectedMachines[order.id] || (isWashing ? 'W-01' : isDrying ? 'D-01' : undefined);

      const res = await api.advanceLaundryStage(order.id, {
        nextStage,
        machineName: machine,
        notes: machine
          ? `Pengerjaan di mesin ${machine} selesai -> lanjut ke ${nextStage}`
          : `Pengerjaan stasiun selesai -> lanjut ke ${nextStage}`,
      });
      if (res.status === 'success') {
        showToast(`Nota ${order.invoiceNumber} berhasil dimajukan ke tahap ${nextStage}${machine ? ` (${machine})` : ''}`);
        fetchData();
      } else {
        showToast(res.message || 'Gagal memajukan tahapan', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setAdvancingId(null);
    }
  };

  return (
    <div className="space-y-5 pb-28 sm:pb-16 font-sans animate-fadeIn">
      {/* Header View */}
      <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4 bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-start gap-3.5 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/20 shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-slate-900">Stasiun Produksi &amp; Pabrikasi</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200 whitespace-nowrap self-start shrink-0">
                Mode Operator Stasiun
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Antarmuka khusus tim pengerjaan cuci, kering, setrika, sortir, dan pengemasan (terisolasi dari transaksi uang kasir)
            </p>
          </div>
        </div>

        {/* Action Controls in Header: Fast Scan & Search */}
        <div className="flex items-center gap-2.5 w-full xl:w-auto flex-wrap sm:flex-nowrap shrink-0">
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-black shadow-md shadow-blue-900/20 transition-all cursor-pointer shrink-0 active:scale-95 whitespace-nowrap"
            title="Pindai QR / Barcode Nota dengan Scanner USB atau Kamera"
          >
            <QrCode className="w-4 h-4 text-blue-200" />
            <span>Scan QR / Barcode Nota</span>
          </button>

          {/* Core Phase 2: Batch Mesin & Scan Tag */}
          <button
            type="button"
            onClick={() => {
              setSelectedBatchOrderIds([]);
              setBatchBoardModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-3.5 bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95 whitespace-nowrap"
            title="Kelola & Jalankan Batch Mesin Cuci/Dryer"
          >
            <Layers className="w-4 h-4 text-sky-700" />
            <span>Batch Mesin</span>
          </button>

          <button
            type="button"
            onClick={() => setTagScannerModalOpen(true)}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-3.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95 whitespace-nowrap"
            title="Pindai Tag QR/Barcode Satuan Pakaian"
          >
            <Tag className="w-4 h-4 text-blue-700" />
            <span>Scan Tag</span>
          </button>

          {canManageMachines && (
            <button
              type="button"
              onClick={() => {
                setEditingMachine(null);
                setMachineFormCode('');
                setMachineFormName('');
                setMachineFormType('WASHER');
                setMachineFormCapacity('10');
                setMachineFormStatus('ACTIVE');
                setManageMachinesModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95"
              title="Kelola Master Nomor & Status Mesin Outlet"
            >
              <Wrench className="w-4 h-4 text-slate-500" />
              <span>Kelola Mesin ({machines.length})</span>
            </button>
          )}

          {canManageMachines && (
            <button
              type="button"
              onClick={() => setIncidentManagementOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 h-10 px-3.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0 active:scale-95"
              title="Manajemen Insiden Produksi & Komplain Ganti Rugi"
            >
              <ShieldAlert className="w-4 h-4 text-rose-600" />
              <span>Insiden ({orders.reduce((sum, o) => sum + (o.incidentCount || 0), 0)})</span>
            </button>
          )}

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari nota, pelanggan, layanan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 h-10 text-[13px] sm:text-sm font-semibold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-900 focus:outline-none transition-all shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* Mode / Tab Switcher: Stasiun Workshop vs Prioritas SLA & Batch */}
      <div className="flex border-b border-slate-200 bg-white px-5 rounded-2xl shadow-xs">
        <button
          type="button"
          onClick={() => setProductionViewTab('STATION')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
            productionViewTab === 'STATION'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Stasiun Workshop</span>
        </button>
        <button
          type="button"
          onClick={() => setProductionViewTab('PRIORITY_QUEUE')}
          className={`py-3 px-4 text-xs font-bold border-b-2 transition-colors flex items-center gap-2 ${
            productionViewTab === 'PRIORITY_QUEUE'
              ? 'border-blue-900 text-blue-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Prioritas SLA &amp; Batch</span>
        </button>
      </div>

      {productionViewTab === 'PRIORITY_QUEUE' ? (
        <SmartProductionQueuePanel
          activeOutletId={activeOutlet?.id || ''}
          onOpenBatchWithOrders={(orderIds) => {
            setSelectedBatchOrderIds(orderIds);
            setBatchBoardModalOpen(true);
          }}
          onOpenItemTracking={(order) => {
            setSelectedOrderForTracking(order);
            setItemTrackingModalOpen(true);
          }}
        />
      ) : (
        <>

      {/* Ringkasan Beban Kerja Antrean */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => setActiveStation('SORTING')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeStation === 'SORTING'
              ? 'bg-blue-900 text-white border-blue-900 shadow-md shadow-blue-900/20'
              : 'bg-white border-slate-200 hover:border-blue-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Filter className={`w-5 h-5 ${activeStation === 'SORTING' ? 'text-blue-200' : 'text-blue-900'}`} />
            <span className={`font-mono text-xl font-black ${activeStation === 'SORTING' ? 'text-white' : 'text-slate-900'}`}>
              {stats.sortingCount}
            </span>
          </div>
          <div className="font-extrabold text-xs">Stasiun Sortir &amp; QC</div>
          <div className={`text-[10px] ${activeStation === 'SORTING' ? 'text-blue-200' : 'text-slate-400'}`}>
            Hitung helai &amp; cek kendala
          </div>
        </div>

        <div
          onClick={() => setActiveStation('WASHING_DRYING')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeStation === 'WASHING_DRYING'
              ? 'bg-blue-900 text-white border-blue-900 shadow-md shadow-blue-900/20'
              : 'bg-white border-slate-200 hover:border-blue-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Waves className={`w-5 h-5 ${activeStation === 'WASHING_DRYING' ? 'text-indigo-200' : 'text-indigo-600'}`} />
            <span className={`font-mono text-xl font-black ${activeStation === 'WASHING_DRYING' ? 'text-white' : 'text-slate-900'}`}>
              {stats.washDryCount}
            </span>
          </div>
          <div className="font-extrabold text-xs">Stasiun Cuci &amp; Kering</div>
          <div className={`text-[10px] ${activeStation === 'WASHING_DRYING' ? 'text-indigo-200' : 'text-slate-400'}`}>
            Mesin washer &amp; dryer
          </div>
        </div>

        <div
          onClick={() => setActiveStation('IRONING_FOLDING')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeStation === 'IRONING_FOLDING'
              ? 'bg-blue-900 text-white border-blue-900 shadow-md shadow-blue-900/20'
              : 'bg-white border-slate-200 hover:border-blue-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Flame className={`w-5 h-5 ${activeStation === 'IRONING_FOLDING' ? 'text-amber-200' : 'text-amber-600'}`} />
            <span className={`font-mono text-xl font-black ${activeStation === 'IRONING_FOLDING' ? 'text-white' : 'text-slate-900'}`}>
              {stats.ironFoldCount}
            </span>
          </div>
          <div className="font-extrabold text-xs">Stasiun Setrika &amp; Lipat</div>
          <div className={`text-[10px] ${activeStation === 'IRONING_FOLDING' ? 'text-amber-200' : 'text-slate-400'}`}>
            Boiler uap &amp; folding
          </div>
        </div>

        <div
          onClick={() => setActiveStation('PACKING_RACK')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeStation === 'PACKING_RACK'
              ? 'bg-blue-900 text-white border-blue-900 shadow-md shadow-blue-900/20'
              : 'bg-white border-slate-200 hover:border-blue-200 text-slate-800'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <Package className={`w-5 h-5 ${activeStation === 'PACKING_RACK' ? 'text-emerald-200' : 'text-emerald-600'}`} />
            <span className={`font-mono text-xl font-black ${activeStation === 'PACKING_RACK' ? 'text-white' : 'text-slate-900'}`}>
              {stats.packRackCount}
            </span>
          </div>
          <div className="font-extrabold text-xs">Stasiun Packing &amp; Rak</div>
          <div className={`text-[10px] ${activeStation === 'PACKING_RACK' ? 'text-emerald-200' : 'text-slate-400'}`}>
            Parfum, segel &amp; simpan rak
          </div>
        </div>
      </div>

      {/* Tabs Filter Bar & SLA Instant Filter */}
      <div className="space-y-3 border-b border-slate-200 pb-3">
        {/* Row 1: Station Tabs */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-nowrap pb-1 max-w-full">
            {[
              { key: 'ALL', label: 'Semua Stasiun', count: stats.total },
              { key: 'SORTING', label: '1. Sortir & QC', count: stats.sortingCount },
              { key: 'WASHING_DRYING', label: '2. Cuci & Kering', count: stats.washDryCount },
              { key: 'IRONING_FOLDING', label: '3. Setrika & Lipat', count: stats.ironFoldCount },
              { key: 'PACKING_RACK', label: '4. Packing & Rak', count: stats.packRackCount },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveStation(tab.key as any)}
                className={`px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  activeStation === tab.key
                    ? 'bg-blue-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    activeStation === tab.key ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <span className="text-xs text-slate-400 font-semibold">
            Menampilkan {filteredOrders.length} nota cucian aktif
          </span>
        </div>

        {/* Row 2: SLA Instant Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none flex-nowrap pt-1 pb-1">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1 shrink-0">
            <Clock className="w-3.5 h-3.5" />
            <span>Filter SLA:</span>
          </span>

          <button
            type="button"
            onClick={() => setSlaFilter('ALL')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              slaFilter === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>Semua Jadwal</span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-black/20">
              {stats.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSlaFilter('DUE_TODAY')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              slaFilter === 'DUE_TODAY'
                ? 'bg-amber-500 text-white shadow-sm'
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
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              slaFilter === 'OVERDUE'
                ? 'bg-rose-600 text-white shadow-sm'
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
      </div>

      {/* Grid Kartu Pengerjaan Stasiun */}
      {loading ? (
        <div className="p-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
          <div className="inline-block w-8 h-8 border-3 border-blue-900 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="font-bold text-sm">Memuat antrean stasiun produksi...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-16 text-center bg-white border border-slate-200 rounded-3xl space-y-2 shadow-xs">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <h3 className="font-black text-slate-800 text-base">Tidak Ada Antrean di Stasiun Ini</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {slaFilter !== 'ALL'
              ? 'Tidak ada pesanan cucian yang sesuai dengan filter SLA yang dipilih.'
              : 'Seluruh cucian pada stasiun ini sudah selesai dikerjakan atau berpindah ke stasiun berikutnya.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const currentStage = (order.currentStage || 'DROP_OFF').toUpperCase();
            const isAtSorting =
              currentStage === 'DROP_OFF' || currentStage === 'TAGGING' || currentStage === 'LABEL' || currentStage === 'SORTING' || currentStage === 'SORTIR';
            const isWashing = currentStage === 'WASHING' || currentStage === 'CUCI';
            const isDrying = currentStage === 'DRYING' || currentStage === 'KERING';
            const isAdvancing = advancingId === order.id;
            const slaStatus = getSlaStatus(order);
            const currentMachineTag = selectedMachines[order.id] || (isWashing ? 'W-01' : isDrying ? 'D-01' : undefined);

            return (
              <div
                key={order.id}
                className={`bg-white rounded-3xl border p-4 sm:p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3 sm:space-y-4 ${
                  slaStatus === 'OVERDUE'
                    ? 'border-rose-300 ring-1 ring-rose-200'
                    : slaStatus === 'DUE_TODAY'
                    ? 'border-amber-300'
                    : 'border-slate-200'
                }`}
              >
                {/* Header Kartu */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-mono text-xs font-black text-blue-900 block truncate">
                        {order.invoiceNumber}
                      </span>
                      <h4 className="font-black text-slate-900 text-sm truncate">{order.customerName}</h4>
                    </div>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {Boolean(order.defectNotes && order.defectNotes.includes('[REWASH/GARANSI:')) && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white border border-rose-700 flex items-center gap-1 shadow-2xs">
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>GARANSI / REWASH</span>
                        </span>
                      )}

                      {Boolean(order.hasOpenIncident || (order.incidentCount && order.incidentCount > 0)) && (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 shadow-2xs">
                          <ShieldAlert className="w-2.5 h-2.5 text-rose-600" />
                          <span>Insiden ({order.incidentCount || 1})</span>
                        </span>
                      )}

                      {/* Badge Tahapan Aktif */}
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-900 border border-blue-200">
                        {stages.find((st) => st.key === currentStage || st.id === currentStage)?.name || order.currentStage || 'Drop-off'}
                      </span>

                      {/* SLA Alert Badge */}
                      {slaStatus === 'OVERDUE' ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-300 flex items-center gap-1">
                          <AlertOctagon className="w-2.5 h-2.5 text-rose-600" />
                          <span>Terlambat SLA</span>
                        </span>
                      ) : slaStatus === 'DUE_TODAY' ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-300 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-amber-600" />
                          <span>Hari Ini</span>
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* Info Layanan & Timbangan */}
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs space-y-1">
                    <div className="flex items-center justify-between font-bold text-slate-700">
                      <span className="truncate max-w-[180px]" title={order.serviceSummary || order.serviceName}>
                        {order.serviceSummary || order.serviceName}
                      </span>
                      <span className="font-mono text-blue-950 font-black shrink-0">
                        {order.totalWeightKg ? `${order.totalWeightKg} Kg` : `${order.totalPieces} Pcs`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Aroma Parfum:</span>
                      <span className="font-semibold text-purple-900">{order.perfumeVariant || 'Reguler'}</span>
                    </div>
                    {order.rackCode && (
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Slot Rak Simpan:</span>
                        <span className="font-mono font-black text-emerald-800">{order.rackCode}</span>
                      </div>
                    )}
                    {order.estimatedReadyAt && (
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 border-t border-slate-200/60">
                        <span>Target Selesai:</span>
                        <span className={`font-mono font-bold ${
                          slaStatus === 'OVERDUE' ? 'text-rose-700' : slaStatus === 'DUE_TODAY' ? 'text-amber-800' : 'text-slate-700'
                        }`}>
                          {new Date(order.estimatedReadyAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Status Sortir & QC Alert */}
                  {order.isSorted ? (
                    <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900 flex items-center justify-between">
                      <span className="font-bold flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Sortir Selesai ({order.totalPieces} Helai)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedOrderForSorting(order)}
                        className="text-[10px] font-extrabold text-blue-900 underline hover:text-blue-950 cursor-pointer p-1"
                      >
                        Lihat Helai
                      </button>
                    </div>
                  ) : isAtSorting ? (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>Belum dihitung sortir helai pakaian</span>
                    </div>
                  ) : null}

                  {/* Warning jika ada defect */}
                  {Array.isArray(order.defects) && order.defects.length > 0 && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 space-y-1">
                      <div className="font-extrabold flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-rose-600" />
                        <span>Catatan QC Kendala:</span>
                      </div>
                      <div className="text-[10px] text-rose-800 italic">
                        {order.defectNotes || order.defects.join(', ')}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer Action Buttons with Mobile-Ergonomic Touch Targets (>= 44px) */}
                <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                  {!isAtSorting && (isWashing || isDrying) && (
                    <div className="w-full bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80">
                      <div className="flex items-center justify-between text-[11px] mb-2 font-bold text-slate-600">
                        <span>Pilih Nomor Mesin ({isWashing ? 'Cuci' : 'Pengering'}):</span>
                        <span className="font-mono font-black text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                          {currentMachineTag}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(() => {
                          const targetType = isWashing ? 'WASHER' : 'DRYER';
                          const filtered = machines.filter((m) => m.machineType === targetType);
                          const machineList = filtered.length > 0
                            ? filtered
                            : (isWashing
                                ? ['W-01', 'W-02', 'W-03', 'W-04']
                                : ['D-01', 'D-02', 'D-03', 'D-04']
                              ).map((code) => ({ id: code, code, name: code, machineType: targetType, status: 'ACTIVE' as const }));

                          return machineList.map((m) => {
                            const isSelected = currentMachineTag === m.code;
                            const isMaintenance = m.status === 'MAINTENANCE';
                            return (
                              <button
                                key={m.id || m.code}
                                type="button"
                                disabled={isMaintenance}
                                onClick={() => setSelectedMachines((prev) => ({ ...prev, [order.id]: m.code }))}
                                className={`py-1.5 text-center font-mono font-black text-xs rounded-xl transition-all cursor-pointer relative ${
                                  isSelected
                                    ? 'bg-blue-900 text-white shadow-xs'
                                    : isMaintenance
                                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed opacity-60'
                                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                                }`}
                                title={isMaintenance ? `${m.code} sedang servis / maintenance` : m.name}
                              >
                                {m.code}
                                {isMaintenance && (
                                  <span className="block text-[8px] font-sans font-bold text-rose-500 leading-none">
                                    Servis
                                  </span>
                                )}
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedOrderForIncident(order);
                        setIncidentModalOpen(true);
                      }}
                      className="h-11 sm:h-10 min-h-[44px] px-2.5 rounded-2xl bg-slate-50 hover:bg-rose-50 text-slate-700 hover:text-rose-800 font-extrabold text-xs flex items-center justify-center gap-1 border border-slate-200 hover:border-rose-200 cursor-pointer active:scale-95 transition-all shrink-0"
                      title="Lapor Pakaian Rusak / Hilang"
                    >
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                      <span className="hidden sm:inline">Insiden</span>
                    </button>
                    {(order.status === 'READY_FOR_PICKUP' || order.status === 'COMPLETED') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrderForRewash(order);
                          setRewashModalOpen(true);
                        }}
                        className="h-11 sm:h-10 min-h-[44px] px-3 rounded-2xl bg-rose-50 hover:bg-rose-100 text-rose-800 font-extrabold text-xs flex items-center justify-center gap-1.5 border border-rose-200 cursor-pointer active:scale-95 transition-all shrink-0"
                        title="Klaim Garansi Cuci Ulang (Rp 0)"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                        <span>Cuci Ulang</span>
                      </button>
                    )}
                    {isAtSorting ? (
                      <button
                        type="button"
                        onClick={() => setSelectedOrderForSorting(order)}
                        className="w-full h-11 sm:h-10 min-h-[44px] rounded-2xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs shadow-md shadow-blue-900/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Filter className="w-4 h-4" />
                        <span>Buka Form Sortir &amp; QC</span>
                      </button>
                    ) : order.currentStage === 'RACK_STORAGE' || order.status === 'READY_FOR_PICKUP' ? (
                      <div className="w-full h-11 sm:h-10 min-h-[44px] rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 px-3">
                        <Archive className="w-4 h-4 text-blue-900" />
                        <span>Siap Diambil di Kasir (Rak: {order.rackCode || 'RAK-A1'})</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleQuickAdvance(order)}
                        disabled={isAdvancing}
                        className="w-full h-11 sm:h-10 min-h-[44px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-md shadow-emerald-600/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        <span>{isAdvancing ? 'Memproses...' : 'Selesai & Lanjut Tahap'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
      )}

      {/* Modal Batch Mesin (Core Phase 2) */}
      {batchBoardModalOpen && (
        <LaundryBatchBoardModal
          isOpen={batchBoardModalOpen}
          onClose={() => setBatchBoardModalOpen(false)}
          activeOutletId={activeOutlet?.id || ''}
          preselectedOrderIds={selectedBatchOrderIds}
          onBatchUpdated={() => fetchData()}
        />
      )}

      {/* Modal Quick Tag Scanner (Core Phase 2) */}
      {tagScannerModalOpen && (
        <LaundryTagScannerModal
          isOpen={tagScannerModalOpen}
          onClose={() => setTagScannerModalOpen(false)}
          onStageChanged={() => fetchData()}
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
          onUpdated={() => fetchData()}
        />
      )}

      {/* Modal Form Sortir Pakaian */}
      {selectedOrderForSorting && (
        <LaundrySortingModal
          isOpen={!!selectedOrderForSorting}
          onClose={() => setSelectedOrderForSorting(null)}
          order={selectedOrderForSorting}
          storeName={activeOutlet?.name || 'Well POS Laundry'}
          storeAddress={activeOutlet?.address || ''}
          storePhone={activeOutlet?.phone || ''}
          onSorted={() => {
            fetchData();
            setSelectedOrderForSorting(null);
          }}
        />
      )}

      {/* Modal Barcode Scanner */}
      {scannerOpen && (
        <LaundryBarcodeScannerModal
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          orders={orders}
          onOrderFound={(order) => {
            setSearchQuery(order.invoiceNumber);
            setScannerOpen(false);
            showToast(`Nota ${order.invoiceNumber} berhasil ditemukan`);
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
            fetchData();
            showToast(`Garansi cuci ulang Nota ${selectedOrderForRewash.invoiceNumber} berhasil diaktifkan!`);
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
            fetchData();
            showToast('Laporan insiden berhasil dicatat');
          }}
        />
      )}

      {/* Modal Manajemen Insiden Produksi (Owner / Supervisor) */}
      {incidentManagementOpen && (
        <LaundryIncidentManagementModal
          isOpen={incidentManagementOpen}
          onClose={() => setIncidentManagementOpen(false)}
          outletId={activeOutlet?.id || ''}
        />
      )}

      {/* Modal Kelola Mesin Outlet (Washer & Dryer) */}
      {manageMachinesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92dvh] sm:max-h-[90vh] flex flex-col">
            {/* Header Modal */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-blue-100 border border-blue-200 text-blue-900 flex items-center justify-center font-bold shrink-0">
                  <Wrench className="w-4 h-4 text-blue-900" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold text-slate-900 truncate">
                    Kelola Mesin Cuci &amp; Pengering
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate">
                    Master nomor mesin operasional &amp; status perawatan / servis
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManageMachinesModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
              {/* Form Tambah / Edit Mesin */}
              <form onSubmit={handleSaveMachine} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-xs">
                    {editingMachine ? `Edit Mesin ${editingMachine.code}` : '+ Tambah Mesin Baru'}
                  </span>
                  {editingMachine && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMachine(null);
                        setMachineFormCode('');
                        setMachineFormName('');
                      }}
                      className="text-[11px] text-slate-500 hover:text-slate-800 font-bold cursor-pointer"
                    >
                      Batal Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Kode Mesin *</label>
                    <input
                      type="text"
                      required
                      disabled={Boolean(editingMachine)}
                      placeholder="Misal: W-05"
                      value={machineFormCode}
                      onChange={(e) => setMachineFormCode(e.target.value.toUpperCase())}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 font-mono font-bold bg-white uppercase disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Nama / Merk *</label>
                    <input
                      type="text"
                      required
                      placeholder="Misal: Washer LG 15 Kg"
                      value={machineFormName}
                      onChange={(e) => setMachineFormName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 font-semibold bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Jenis Mesin *</label>
                    <div className="relative">
                      <select
                        value={machineFormType}
                        onChange={(e) => setMachineFormType(e.target.value as any)}
                        className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 font-bold bg-white appearance-none pr-8 cursor-pointer"
                      >
                        <option value="WASHER">Washer (Cuci)</option>
                        <option value="DRYER">Dryer (Kering)</option>
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1">Kapasitas (Kg)</label>
                    <input
                      type="number"
                      step={0.5}
                      min={1}
                      value={machineFormCapacity}
                      onChange={(e) => setMachineFormCapacity(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 font-bold bg-white"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 pt-1">
                  <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
                    <label className="text-[11px] font-bold text-slate-600 whitespace-nowrap">Status Awal:</label>
                    <div className="relative flex-1 sm:flex-none">
                      <select
                        value={machineFormStatus}
                        onChange={(e) => setMachineFormStatus(e.target.value as any)}
                        className="h-9 w-full sm:w-auto text-xs px-2.5 rounded-lg border border-slate-300 font-bold bg-white appearance-none pr-7 cursor-pointer"
                      >
                        <option value="ACTIVE">Aktif (Bisa Dipakai)</option>
                        <option value="MAINTENANCE">Maintenance / Servis</option>
                        <option value="INACTIVE">Nonaktif</option>
                      </select>
                      <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={savingMachine}
                    className="h-9 px-4 w-full sm:w-auto bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    {savingMachine ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Plus className="w-3.5 h-3.5 shrink-0" />}
                    <span>{editingMachine ? 'Simpan Perubahan' : 'Tambah Mesin'}</span>
                  </button>
                </div>
              </form>

              {/* Daftar Mesin Saat Ini */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 text-xs font-bold text-slate-700">
                  <span>Daftar Mesin Outlet ({machines.length} Unit)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Klik tombol status untuk mengubah Aktif / Maintenance</span>
                </div>

                {loadingMachines ? (
                  <div className="p-8 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-900" />
                    <span>Memuat daftar mesin...</span>
                  </div>
                ) : machines.length === 0 ? (
                  <div className="p-6 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-200">
                    Belum ada mesin terdaftar. Mesin standar akan dibuat otomatis saat pertama kali dibuka.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {machines.map((m) => {
                      const isMaintenance = m.status === 'MAINTENANCE';
                      return (
                        <div
                          key={m.id}
                          className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-2 ${
                            isMaintenance
                              ? 'bg-amber-50/60 border-amber-200'
                              : 'bg-white border-slate-200 shadow-2xs'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-black text-xs text-blue-950 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {m.code}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                m.machineType === 'WASHER' ? 'bg-blue-50 text-blue-800' : 'bg-purple-50 text-purple-800'
                              }`}>
                                {m.machineType === 'WASHER' ? 'Washer' : 'Dryer'}
                              </span>
                              <span className="text-[10px] text-slate-400 font-medium">
                                {Number(m.capacityKg)} Kg
                              </span>
                            </div>
                            <div className="font-extrabold text-xs text-slate-800 truncate mt-0.5">
                              {m.name}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleToggleMachineStatus(m)}
                              className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
                                isMaintenance
                                  ? 'bg-amber-500 text-white border-amber-500 hover:bg-amber-600'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                              }`}
                              title="Klik untuk ubah status mesin"
                            >
                              {isMaintenance ? 'Servis' : 'Aktif'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingMachine(m);
                                setMachineFormCode(m.code);
                                setMachineFormName(m.name);
                                setMachineFormType(m.machineType);
                                setMachineFormCapacity(String(m.capacityKg));
                                setMachineFormStatus(m.status);
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-blue-900 hover:bg-slate-100 cursor-pointer"
                              title="Edit Mesin"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMachine(m)}
                              className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 cursor-pointer"
                              title="Hapus Mesin"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Action Footer */}
            <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-end">
              <button
                type="button"
                onClick={() => setManageMachinesModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-950 text-white font-bold text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed bottom-24 md:bottom-6 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold animate-fadeIn transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
              : 'bg-rose-950 text-rose-100 border-rose-700'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
};
