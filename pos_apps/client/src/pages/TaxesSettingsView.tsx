import React, { useState, useEffect, useMemo } from 'react';
import {
  Percent,
  Sliders,
  Store,
  HelpCircle,
  Building2,
  DollarSign,
  Package,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Star,
  Receipt,
  Bike,
  Globe,
  UtensilsCrossed,
  Save,
  ShieldCheck,
  ShoppingBag,
} from 'lucide-react';
import type { Outlet, OutletFee, FeeType, FeeChannelScope, FeeCategory } from '../types/outlet';
import { normalizeOutletFees } from '../types/outlet';
import { SupervisorFeesModal } from '../components/SupervisorFeesModal';
import { formatRupiah } from '../utils/currency';
import { CurrencyInput } from '../components/ui/CurrencyInput';
import { useDialog } from '../context/DialogContext';
import { api } from '../services/api';

interface TaxesSettingsViewProps {
  activeOutlet: Outlet | null;
  onOutletUpdated?: (updatedOutlet: Outlet) => void;
  currentUserRole?: string;
}

type SettingsTab = 'TAX' | 'SERVICE' | 'PACKAGING' | 'SIMULATOR';

// Helper pemisah kanonikal antara Pajak vs Biaya
export const isTaxFee = (fee: OutletFee): boolean => {
  return (
    fee.id === 'fee_tax' ||
    fee.category === 'DEFAULT_TAX_SERVICE' && (
      fee.name.toLowerCase().includes('pajak') ||
      fee.name.toLowerCase().includes('pb1') ||
      fee.name.toLowerCase().includes('ppn') ||
      fee.name.toLowerCase().includes('pbjt')
    )
  );
};

export const isServiceFee = (fee: OutletFee): boolean => {
  return fee.category !== 'ON_DEMAND_PACKAGING' && !isTaxFee(fee);
};

export const isPackagingFee = (fee: OutletFee): boolean => {
  return fee.category === 'ON_DEMAND_PACKAGING';
};

export const TaxesSettingsView: React.FC<TaxesSettingsViewProps> = ({
  activeOutlet,
  onOutletUpdated,
  currentUserRole,
}) => {
  const dialog = useDialog();
  const [activeTab, setActiveTab] = useState<SettingsTab>('TAX');
  const [feesModalOpen, setFeesModalOpen] = useState(false);

  // State Biaya & Pajak Lokal
  const [fees, setFees] = useState<OutletFee[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Inisialisasi data dari activeOutlet
  useEffect(() => {
    if (activeOutlet) {
      const normalized = normalizeOutletFees(activeOutlet.feesConfig);
      setFees(normalized);
    }
  }, [activeOutlet?.id, activeOutlet?.feesConfig]);

  // Klasifikasi data terpisah 100%
  const taxFees = useMemo(() => fees.filter(isTaxFee), [fees]);
  const serviceFees = useMemo(() => fees.filter(isServiceFee), [fees]);
  const packagingFees = useMemo(() => fees.filter(isPackagingFee), [fees]);

  // Tax item utama
  const primaryTax = taxFees[0] || {
    id: 'fee_tax',
    name: 'PPN / PB1 Pajak Restoran',
    type: 'PERCENTAGE' as FeeType,
    rate: 10,
    channelScope: 'ALL' as FeeChannelScope,
    isActive: false,
    category: 'DEFAULT_TAX_SERVICE' as FeeCategory,
  };

  // State Form Edit Pajak
  const [taxName, setTaxName] = useState(primaryTax.name);
  const [taxRate, setTaxRate] = useState<number>(primaryTax.rate);
  const [taxScope, setTaxScope] = useState<FeeChannelScope>(primaryTax.channelScope);
  const [taxIsActive, setTaxIsActive] = useState<boolean>(primaryTax.isActive);

  // Sinkronkan state form pajak saat primaryTax berubah
  useEffect(() => {
    setTaxName(primaryTax.name);
    setTaxRate(primaryTax.rate);
    setTaxScope(primaryTax.channelScope);
    setTaxIsActive(primaryTax.isActive);
  }, [primaryTax.id, primaryTax.name, primaryTax.rate, primaryTax.channelScope, primaryTax.isActive]);

  // Form Penambahan Biaya Operasional Baru
  const [showAddServiceForm, setShowAddServiceForm] = useState(false);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceType, setNewServiceType] = useState<FeeType>('PERCENTAGE');
  const [newServiceRate, setNewServiceRate] = useState<number>(5);
  const [newServiceScope, setNewServiceScope] = useState<FeeChannelScope>('DINE_IN');

  // Form Penambahan Kemasan Baru
  const [showAddPackagingForm, setShowAddPackagingForm] = useState(false);
  const [newPackagingName, setNewPackagingName] = useState('');
  const [newPackagingRate, setNewPackagingRate] = useState<number>(1000);

  // Inline edit state
  const [editingFeeId, setEditingFeeId] = useState<string | null>(null);
  const [editFeeName, setEditFeeName] = useState('');
  const [editFeeRate, setEditFeeRate] = useState<number>(0);
  const [editFeeScope, setEditFeeScope] = useState<FeeChannelScope>('ALL');

  // State Simulasi Struk
  const [simSubtotal, setSimSubtotal] = useState<number>(100000);
  const [simChannel, setSimChannel] = useState<'DINE_IN' | 'TAKEAWAY' | 'DELIVERY' | 'ONLINE_DELIVERY'>('DINE_IN');
  const [simSelectedPackaging, setSimSelectedPackaging] = useState<string[]>(['fee_plastic_s']);

  // Hitung jumlah pin aktif kemasan
  const activeQuickCount = useMemo(() => {
    return packagingFees.filter((f) => f.isQuickAccess).length;
  }, [packagingFees]);

  // Simpan seluruh perubahan ke server
  const handleSaveToBackend = async (newFeesList: OutletFee[]) => {
    if (!activeOutlet) return;
    setIsSaving(true);
    try {
      const res = await api.updateOutletFees(activeOutlet.id, newFeesList);
      if (res.status === 'success') {
        setFees(newFeesList);
        if (onOutletUpdated) {
          onOutletUpdated({
            ...activeOutlet,
            feesConfig: newFeesList,
          });
        }
        dialog.toast('Konfigurasi pajak & biaya berhasil disimpan!', 'success');
      } else {
        dialog.alert({
          title: 'Gagal Menyimpan',
          message: res.message || 'Terjadi kendala saat menyimpan perubahan.',
          variant: 'danger',
        });
      }
    } catch (err: any) {
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: err.message || 'Gagal menghubungi server.',
        variant: 'danger',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Simpan Pengaturan Pajak
  const handleSaveTax = () => {
    const updatedTax: OutletFee = {
      ...primaryTax,
      name: taxName.trim() || 'PPN / PB1 Pajak Restoran',
      rate: Math.max(0, Number(taxRate)),
      channelScope: taxScope,
      isActive: taxIsActive,
    };

    let updatedList: OutletFee[];
    const exists = fees.some((f) => f.id === primaryTax.id);
    if (exists) {
      updatedList = fees.map((f) => (f.id === primaryTax.id ? updatedTax : f));
    } else {
      updatedList = [updatedTax, ...fees];
    }

    handleSaveToBackend(updatedList);
  };

  // Toggle On/Off Biaya Operasional / Kemasan
  const handleToggleFeeActive = (feeId: string) => {
    const updatedList = fees.map((f) => (f.id === feeId ? { ...f, isActive: !f.isActive } : f));
    setFees(updatedList);
    handleSaveToBackend(updatedList);
  };

  // Toggle Quick Access Pin Kemasan
  const handleToggleQuickAccess = (feeId: string) => {
    const target = fees.find((f) => f.id === feeId);
    if (!target) return;

    if (!target.isQuickAccess && activeQuickCount >= 4) {
      dialog.alert({
        title: 'Batas Akses Cepat Penuh',
        message: 'Maksimal 4 kemasan yang dapat dipin ke Akses Cepat Keranjang Kasir.',
        variant: 'warning',
      });
      return;
    }

    const updatedList = fees.map((f) => (f.id === feeId ? { ...f, isQuickAccess: !f.isQuickAccess } : f));
    setFees(updatedList);
    handleSaveToBackend(updatedList);
  };

  // Tambah Biaya Operasional Baru
  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName.trim()) return;

    const newFee: OutletFee = {
      id: `fee_op_${Date.now()}`,
      name: newServiceName.trim(),
      type: newServiceType,
      rate: Number(newServiceRate),
      channelScope: newServiceScope,
      isActive: true,
      category: 'DEFAULT_TAX_SERVICE',
    };

    const updatedList = [...fees, newFee];
    setFees(updatedList);
    setNewServiceName('');
    setNewServiceRate(5);
    setShowAddServiceForm(false);
    handleSaveToBackend(updatedList);
  };

  // Tambah Kemasan Baru
  const handleAddPackaging = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPackagingName.trim()) return;

    const newFee: OutletFee = {
      id: `fee_pack_${Date.now()}`,
      name: newPackagingName.trim(),
      type: 'FIXED',
      rate: Number(newPackagingRate),
      channelScope: 'ALL',
      isActive: true,
      category: 'ON_DEMAND_PACKAGING',
      isQuickAccess: activeQuickCount < 4,
    };

    const updatedList = [...fees, newFee];
    setFees(updatedList);
    setNewPackagingName('');
    setNewPackagingRate(1000);
    setShowAddPackagingForm(false);
    handleSaveToBackend(updatedList);
  };

  // Hapus Biaya / Kemasan Kustom
  const handleDeleteFee = async (fee: OutletFee) => {
    const isProtectedDefault = fee.id === 'fee_tax';
    if (isProtectedDefault) {
      dialog.alert({
        title: 'Komponen Bawaan Sistem',
        message: `Komponen "${fee.name}" adalah komponen standar pajak dan tidak dapat dihapus. Anda dapat menonaktifkannya melalui tombol status toggle di Tab Pajak Restoran.`,
        variant: 'info',
      });
      return;
    }

    const ok = await dialog.confirm({
      title: 'Hapus Biaya / Kemasan',
      message: `Apakah Anda yakin ingin menghapus "${fee.name}"? Komponen ini tidak akan lagi muncul di kasir.`,
      variant: 'danger',
      confirmText: 'Ya, Hapus',
      cancelText: 'Batal',
    });
    if (!ok) return;

    const updatedList = fees.filter((f) => f.id !== fee.id);
    setFees(updatedList);
    handleSaveToBackend(updatedList);
  };

  // Mulai Edit Inline
  const startEditFee = (fee: OutletFee) => {
    setEditingFeeId(fee.id);
    setEditFeeName(fee.name);
    setEditFeeRate(fee.rate);
    setEditFeeScope(fee.channelScope || 'ALL');
  };

  // Simpan Edit Inline
  const saveEditFee = (feeId: string) => {
    if (!editFeeName.trim()) return;
    const updatedList = fees.map((f) =>
      f.id === feeId
        ? {
            ...f,
            name: editFeeName.trim(),
            rate: Math.max(0, Number(editFeeRate)),
            channelScope: editFeeScope,
          }
        : f
    );
    setFees(updatedList);
    setEditingFeeId(null);
    handleSaveToBackend(updatedList);
  };

  // Kalkulasi Simulator Struk Kasir
  const simulationResults = useMemo(() => {
    let serviceChargeAmount = 0;
    let otherFeesAmount = 0;

    // Hitung Biaya Operasional / Service Charge
    serviceFees.forEach((fee) => {
      if (!fee.isActive) return;
      const matchChannel =
        !fee.channelScope ||
        fee.channelScope === 'ALL' ||
        fee.channelScope === simChannel ||
        (fee.channelScope === 'ONLINE_DELIVERY' && simChannel === 'ONLINE_DELIVERY');

      if (matchChannel) {
        if (fee.id === 'fee_service' || fee.name.toLowerCase().includes('layanan') || fee.name.toLowerCase().includes('service')) {
          if (fee.type === 'PERCENTAGE') {
            serviceChargeAmount += Math.round((simSubtotal * fee.rate) / 100);
          } else {
            serviceChargeAmount += fee.rate;
          }
        } else {
          if (fee.type === 'PERCENTAGE') {
            otherFeesAmount += Math.round((simSubtotal * fee.rate) / 100);
          } else {
            otherFeesAmount += fee.rate;
          }
        }
      }
    });

    // Hitung Kemasan
    let packagingAmount = 0;
    packagingFees.forEach((fee) => {
      if (fee.isActive && simSelectedPackaging.includes(fee.id)) {
        packagingAmount += fee.rate;
      }
    });

    // Sesuai UU HKPD & Regulasi Bapenda: Dasar Pengenaan PB1 adalah Subtotal + Service Charge
    const taxBase = simSubtotal + serviceChargeAmount;
    let taxAmount = 0;
    if (primaryTax.isActive && (primaryTax.channelScope === 'ALL' || primaryTax.channelScope === simChannel)) {
      taxAmount = Math.round((taxBase * primaryTax.rate) / 100);
    }

    const grandTotal = simSubtotal + serviceChargeAmount + otherFeesAmount + packagingAmount + taxAmount;
    const merchantNetIncome = simSubtotal + serviceChargeAmount + otherFeesAmount + packagingAmount;

    return {
      subtotal: simSubtotal,
      serviceChargeAmount,
      otherFeesAmount,
      packagingAmount,
      taxAmount,
      grandTotal,
      merchantNetIncome,
    };
  }, [simSubtotal, simChannel, simSelectedPackaging, serviceFees, packagingFees, primaryTax]);

  return (
    <div className="space-y-6">
      {/* ─── 1. Header Banner & Navigasi ─── */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h2 className="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
              <Percent className="w-5 h-5 text-blue-900" />
              <span>Pajak Restoran &amp; Biaya Operasional Toko</span>
            </h2>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-900 border border-blue-200 flex items-center gap-1">
              <Store className="w-3 h-3 text-blue-800" />
              Toko: {activeOutlet?.name || 'Utama'}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Pemisahan transparan antara <strong>Pajak Daerah (PB1)</strong> titipan pemerintah dengan <strong>Biaya Layanan &amp; Kemasan</strong> operasional restoran.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setFeesModalOpen(true)}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer"
            title="Kelola dengan otorisasi PIN Supervisor"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Mode PIN Supervisor</span>
          </button>
        </div>
      </div>

      {/* ─── 2. Metric KPI Cards (Pemisahan Tegas Pajak vs Biaya) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pajak Daerah PB1 */}
        <div
          onClick={() => setActiveTab('TAX')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeTab === 'TAX'
              ? 'bg-blue-50/70 border-blue-400 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5" />
              Pajak Daerah (PB1)
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                primaryTax.isActive
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {primaryTax.isActive ? 'Aktif' : 'Non-aktif'}
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            {primaryTax.isActive ? `${primaryTax.rate}% PB1` : '0% (Non-aktif)'}
          </p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">
            Pungutan Pemda (Bapenda), bukan omzet toko
          </p>
        </div>

        {/* Card 2: Service Charge */}
        <div
          onClick={() => setActiveTab('SERVICE')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeTab === 'SERVICE'
              ? 'bg-emerald-50/70 border-emerald-400 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
              <DollarSign className="w-3.5 h-3.5" />
              Service Charge
            </span>
            {(() => {
              const svc = serviceFees.find(
                (s) =>
                  s.id === 'fee_service' ||
                  s.name.toLowerCase().includes('layanan') ||
                  s.name.toLowerCase().includes('service')
              );
              const active = svc?.isActive;
              return (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                    active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {active ? 'Aktif' : 'Non-aktif'}
                </span>
              );
            })()}
          </div>
          <p className="text-xl sm:text-2xl font-black text-emerald-800">
            {(() => {
              const svc = serviceFees.find(
                (s) =>
                  s.id === 'fee_service' ||
                  s.name.toLowerCase().includes('layanan') ||
                  s.name.toLowerCase().includes('service')
              );
              return svc && svc.isActive
                ? svc.type === 'PERCENTAGE'
                  ? `${svc.rate}% Layanan`
                  : `${formatRupiah(svc.rate)} Layanan`
                : 'Tidak Diterapkan';
            })()}
          </p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">
            Tips staf &amp; operasional meja makan
          </p>
        </div>

        {/* Card 3: Biaya Pengiriman & Platform */}
        <div
          onClick={() => setActiveTab('SERVICE')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeTab === 'SERVICE'
              ? 'bg-purple-50/70 border-purple-400 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1">
              <Bike className="w-3.5 h-3.5" />
              Kurir &amp; Platform
            </span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
              {
                serviceFees.filter(
                  (s) =>
                    !s.name.toLowerCase().includes('layanan') &&
                    !s.name.toLowerCase().includes('service')
                ).length
              }{' '}
              Komponen
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            Ongkir &amp; Online
          </p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">
            Biaya flat pengantaran kurir &amp; mitra
          </p>
        </div>

        {/* Card 4: Kemasan Takeaway Kasir */}
        <div
          onClick={() => setActiveTab('PACKAGING')}
          className={`p-4 rounded-3xl border transition-all cursor-pointer ${
            activeTab === 'PACKAGING'
              ? 'bg-amber-50/70 border-amber-400 shadow-sm'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1">
              <Package className="w-3.5 h-3.5" />
              Kemasan Takeaway
            </span>
            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 flex items-center gap-1">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              {activeQuickCount}/4 Pin
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-black text-slate-900">
            {packagingFees.length} Wadah
          </p>
          <p className="text-[11px] text-slate-400 font-medium mt-1">
            Add-on kantong / box di keranjang kasir
          </p>
        </div>
      </div>

      {/* ─── 3. Segmented Navigation Tabs ─── */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('TAX')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'TAX'
              ? 'bg-blue-900 text-white shadow-md shadow-blue-900/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>1. Pajak Restoran (PB1 / Daerah)</span>
          {primaryTax.isActive && (
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SERVICE')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'SERVICE'
              ? 'bg-blue-900 text-white shadow-md shadow-blue-900/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <UtensilsCrossed className="w-4 h-4" />
          <span>2. Biaya Layanan &amp; Kurir ({serviceFees.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('PACKAGING')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'PACKAGING'
              ? 'bg-blue-900 text-white shadow-md shadow-blue-900/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>3. Kemasan &amp; Wadah Kasir ({packagingFees.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('SIMULATOR')}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ml-auto ${
            activeTab === 'SIMULATOR'
              ? 'bg-emerald-800 text-white shadow-md shadow-emerald-800/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4 text-emerald-300" />
          <span>4. Simulasi Struk Kasir</span>
        </button>
      </div>

      {/* ─── TAB 1: PENGATURAN PAJAK RESTORAN (PB1 / PBJT) ─── */}
      {activeTab === 'TAX' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Card Pengaturan Pajak Utama */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-900"></span>
                  <h3 className="font-extrabold text-base text-slate-900">
                    Konfigurasi Pajak Daerah (PB1 / PBJT Makanan &amp; Minuman)
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Pajak ini otomatis dipungut oleh kasir saat checkout dan disetorkan pemilik usaha ke Badan Pendapatan Daerah (Bapenda).
                </p>
              </div>

              {/* Toggle Aktif / Nonaktif Pajak */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs font-bold text-slate-600">
                  Status Pajak Kasir:
                </span>
                <button
                  type="button"
                  onClick={() => setTaxIsActive(!taxIsActive)}
                  className={`w-12 h-6.5 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                    taxIsActive ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-md"></div>
                </button>
                <span
                  className={`text-xs font-black ${
                    taxIsActive ? 'text-emerald-700' : 'text-slate-400'
                  }`}
                >
                  {taxIsActive ? 'AKTIF (Dipungut)' : 'NON-AKTIF (Bebas Pajak)'}
                </span>
              </div>
            </div>

            {/* Form Input Detail Pajak */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {/* Nama Pajak */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nama Komponen di Struk
                </label>
                <input
                  type="text"
                  value={taxName}
                  onChange={(e) => setTaxName(e.target.value)}
                  placeholder="Contoh: PPN / PB1 Pajak Restoran"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Nama ini akan dicetak pada kertas struk konsumen.
                </span>
              </div>

              {/* Tarif Pajak (%) */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Tarif Pajak (%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="w-full pl-3.5 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                    %
                  </div>
                </div>

                {/* Preset Cepat */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <span className="text-[10px] font-bold text-slate-400">Preset:</span>
                  <button
                    type="button"
                    onClick={() => setTaxRate(10)}
                    className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 hover:bg-blue-100 text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    10% PB1 (Umum)
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxRate(11)}
                    className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    11% PPN Pusat
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxRate(5)}
                    className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200 text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    5% Khusus
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaxRate(0)}
                    className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 hover:bg-rose-100 text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    0% Bebas
                  </button>
                </div>
              </div>

              {/* Lingkup Saluran Penjualan */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Diterapkan Pada Saluran
                </label>
                <select
                  value={taxScope}
                  onChange={(e) => setTaxScope(e.target.value as FeeChannelScope)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-900 bg-white"
                >
                  <option value="ALL">Semua Transaksi Kasir (Rekomendasi)</option>
                  <option value="DINE_IN">Khusus Makan di Tempat (Dine In)</option>
                  <option value="TAKEAWAY">Khusus Bungkus (Takeaway)</option>
                  <option value="DELIVERY">Khusus Pesanan Diantar (Delivery)</option>
                </select>
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Umumnya pajak restoran berlaku untuk seluruh tipe pesanan.
                </span>
              </div>
            </div>

            {/* Tombol Simpan Pajak */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                Perubahan tarif pajak langsung berlaku seketika di kasir POS.
              </span>
              <button
                type="button"
                onClick={handleSaveTax}
                disabled={isSaving}
                className="px-6 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md shadow-blue-900/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Menyimpan...' : 'Simpan Pengaturan Pajak'}</span>
              </button>
            </div>
          </div>

          {/* Kotak Edukasi Regulasi UU Pajak Daerah */}
          <div className="p-5 rounded-3xl bg-blue-50/70 border border-blue-200/80 text-blue-950 space-y-2">
            <div className="flex items-center gap-2 font-black text-sm text-blue-900">
              <HelpCircle className="w-4 h-4 text-blue-800" />
              <span>Panduan Regulasi Resmi Pajak Restoran (UU No. 1 Tahun 2022 - HKPD):</span>
            </div>
            <p className="text-xs text-blue-900/90 leading-relaxed font-medium">
              1. <strong>Bukan PPN Kemenkeu:</strong> Makanan dan minuman yang disediakan di restoran, rumah makan, kafe, dan bar merupakan objek <strong>Pajak Barang dan Jasa Tertentu (PBJT)</strong> daerah dengan tarif maksimal <strong>10%</strong>.
            </p>
            <p className="text-xs text-blue-900/90 leading-relaxed font-medium">
              2. <strong>Dasar Pengenaan Pajak (DPP):</strong> Sesuai regulasi, PB1 10% dihitung dari <strong>(Subtotal Penjualan + Biaya Layanan / Service Charge)</strong>.
            </p>
            <p className="text-xs text-blue-900/90 leading-relaxed font-medium">
              3. <strong>Penyetoran:</strong> Pajak yang dipungut dari konsumen ini wajib dilaporkan dan disetorkan ke Bapenda setempat setiap bulannya.
            </p>
          </div>
        </div>
      )}

      {/* ─── TAB 2: BIAYA LAYANAN & KURIR OPERASIONAL ─── */}
      {activeTab === 'SERVICE' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Header Sub-seksi */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                  <UtensilsCrossed className="w-4 h-4 text-emerald-700" />
                  <span>Daftar Biaya Layanan &amp; Penanganan Operasional</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Biaya tambahan internal yang menjadi hak / pendapatan restoran (Service Charge, Ongkir Kurir Toko, dll).
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddServiceForm(!showAddServiceForm)}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Biaya Baru</span>
              </button>
            </div>

            {/* Form Tambah Biaya Baru */}
            {showAddServiceForm && (
              <form onSubmit={handleAddService} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">
                    Tambah Biaya Operasional Resto Baru
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowAddServiceForm(false)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Nama Biaya
                    </label>
                    <input
                      type="text"
                      required
                      value={newServiceName}
                      onChange={(e) => setNewServiceName(e.target.value)}
                      placeholder="Contoh: Biaya Penanganan Meja VIP"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Tipe Tarif
                    </label>
                    <select
                      value={newServiceType}
                      onChange={(e) => setNewServiceType(e.target.value as FeeType)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-white"
                    >
                      <option value="PERCENTAGE">Persentase (%)</option>
                      <option value="FIXED">Nominal Tetap (Rp)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Nominal / Persentase
                    </label>
                    {newServiceType === 'PERCENTAGE' ? (
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={newServiceRate}
                          onChange={(e) => setNewServiceRate(Number(e.target.value))}
                          className="w-full pl-3 pr-8 py-2 rounded-xl border border-slate-200 text-xs font-black focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-white"
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                      </div>
                    ) : (
                      <CurrencyInput
                        value={newServiceRate}
                        onChange={(num) => setNewServiceRate(num)}
                        placeholder="0"
                        className="w-full"
                        inputClassName="text-xs py-2 bg-white"
                      />
                    )}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Diterapkan Khusus Kanal
                    </label>
                    <select
                      value={newServiceScope}
                      onChange={(e) => setNewServiceScope(e.target.value as FeeChannelScope)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-700 bg-white"
                    >
                      <option value="ALL">Semua Kanal</option>
                      <option value="DINE_IN">Makan di Tempat (Dine In)</option>
                      <option value="TAKEAWAY">Bawa Pulang (Takeaway)</option>
                      <option value="DELIVERY">Kurir Toko (Delivery)</option>
                      <option value="ONLINE_DELIVERY">Mitra Online (GoFood/Grab/Shopee)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2 flex items-end">
                    <button
                      type="submit"
                      className="w-full py-2 bg-emerald-700 hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all"
                    >
                      Simpan Biaya Baru
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* List Biaya Layanan */}
            <div className="divide-y divide-slate-100">
              {serviceFees.length === 0 ? (
                <div className="py-8 text-center text-slate-400">
                  <p className="text-xs font-bold">Belum ada biaya layanan atau kurir terpasang.</p>
                </div>
              ) : (
                serviceFees.map((fee) => {
                  const isEditing = editingFeeId === fee.id;

                  return (
                    <div key={fee.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center font-black text-xs shrink-0">
                          {fee.type === 'PERCENTAGE' ? '%' : 'Rp'}
                        </div>
                        {isEditing ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              type="text"
                              value={editFeeName}
                              onChange={(e) => setEditFeeName(e.target.value)}
                              className="px-2 py-1 rounded-lg border border-slate-300 text-xs font-bold"
                            />
                            {fee.type === 'PERCENTAGE' ? (
                              <input
                                type="number"
                                value={editFeeRate}
                                onChange={(e) => setEditFeeRate(Number(e.target.value))}
                                className="w-16 px-2 py-1 rounded-lg border border-slate-300 text-xs font-bold"
                              />
                            ) : (
                              <div className="w-28">
                                <CurrencyInput
                                  value={editFeeRate}
                                  onChange={(num) => setEditFeeRate(num)}
                                  inputClassName="text-xs py-1"
                                />
                              </div>
                            )}
                            <select
                              value={editFeeScope}
                              onChange={(e) => setEditFeeScope(e.target.value as FeeChannelScope)}
                              className="px-2 py-1 rounded-lg border border-slate-300 text-xs"
                            >
                              <option value="ALL">Semua Kanal</option>
                              <option value="DINE_IN">Dine In</option>
                              <option value="TAKEAWAY">Takeaway</option>
                              <option value="DELIVERY">Delivery</option>
                              <option value="ONLINE_DELIVERY">Online Delivery</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => saveEditFee(fee.id)}
                              className="p-1.5 bg-emerald-700 text-white rounded-lg hover:bg-emerald-600"
                              title="Simpan"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingFeeId(null)}
                              className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300"
                              title="Batal"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                                {fee.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium mt-0.5">
                              <span>Tarif: <strong>{fee.type === 'PERCENTAGE' ? `${fee.rate}%` : formatRupiah(fee.rate)}</strong></span>
                              <span>•</span>
                              <span>Kanal: {fee.channelScope || 'Semua Kanal'}</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Aksi Baris */}
                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => startEditFee(fee)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="Edit Tarif & Kanal"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteFee(fee)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Biaya"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleFeeActive(fee.id)}
                            className={`w-10 h-5.5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                              fee.isActive ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                            }`}
                          >
                            <div className="w-4.5 h-4.5 rounded-full bg-white shadow-xs"></div>
                          </button>
                          <span className={`text-[11px] font-bold ${fee.isActive ? 'text-emerald-700' : 'text-slate-400'}`}>
                            {fee.isActive ? 'Aktif' : 'Off'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: KEMASAN & WADAH KASIR (ON-DEMAND) ─── */}
      {activeTab === 'PACKAGING' && (
        <div className="space-y-5 animate-fadeIn">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-amber-700" />
                  <h3 className="font-extrabold text-base text-slate-900">
                    Wadah Kemasan &amp; Add-on Bawa Pulang (Takeaway)
                  </h3>
                  <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                    Terpin ke Kasir: {activeQuickCount} / 4
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Item fisik tambahan yang dapat dipilih kasir secara on-demand saat membungkus pesanan konsumen.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowAddPackagingForm(!showAddPackagingForm)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Kemasan</span>
              </button>
            </div>

            {/* Form Tambah Kemasan */}
            {showAddPackagingForm && (
              <form onSubmit={handleAddPackaging} className="p-4 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-amber-900 uppercase tracking-wider">
                    Tambah Opsi Kemasan / Wadah Baru
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowAddPackagingForm(false)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Nama Wadah / Kemasan
                    </label>
                    <input
                      type="text"
                      required
                      value={newPackagingName}
                      onChange={(e) => setNewPackagingName(e.target.value)}
                      placeholder="Contoh: Paper Cup Panas 12oz"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-600 bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Harga Satuan (Rp)
                    </label>
                    <CurrencyInput
                      value={newPackagingRate}
                      onChange={(num) => setNewPackagingRate(num)}
                      placeholder="0"
                      className="w-full"
                      inputClassName="text-xs py-2 bg-white"
                    />
                  </div>

                  <div className="sm:col-span-3 flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all"
                    >
                      Simpan Kemasan Baru
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* List Kemasan */}
            <div className="divide-y divide-slate-100">
              {packagingFees.map((pkg) => {
                const isEditing = editingFeeId === pkg.id;

                return (
                  <div key={pkg.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editFeeName}
                            onChange={(e) => setEditFeeName(e.target.value)}
                            className="px-2 py-1 rounded-lg border border-slate-300 text-xs font-bold"
                          />
                          <div className="w-28">
                            <CurrencyInput
                              value={editFeeRate}
                              onChange={(num) => setEditFeeRate(num)}
                              inputClassName="text-xs py-1"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => saveEditFee(pkg.id)}
                            className="p-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-500"
                            title="Simpan"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingFeeId(null)}
                            className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300"
                            title="Batal"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                              {pkg.name}
                            </span>
                            {pkg.isQuickAccess && (
                              <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500" />
                                Terpin di Kasir
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 font-medium">
                            Tarif Kasir: <strong className="text-slate-800">{formatRupiah(pkg.rate)}</strong>
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Aksi Baris Kemasan */}
                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      {/* Tombol Pin Akses Cepat */}
                      <button
                        type="button"
                        onClick={() => handleToggleQuickAccess(pkg.id)}
                        className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
                          pkg.isQuickAccess
                            ? 'bg-amber-100 border-amber-300 text-amber-900 hover:bg-amber-200'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}
                        title="Tampilkan tombol pintasan cepat di keranjang kasir POS (Maksimal 4 item)"
                      >
                        <Star className={`w-3.5 h-3.5 ${pkg.isQuickAccess ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
                        <span>{pkg.isQuickAccess ? 'Terpin Kasir' : 'Pin ke Kasir'}</span>
                      </button>

                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => startEditFee(pkg)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Ubah Nama & Harga"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleDeleteFee(pkg)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Kemasan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleFeeActive(pkg.id)}
                          className={`w-10 h-5.5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer ${
                            pkg.isActive ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                          }`}
                        >
                          <div className="w-4.5 h-4.5 rounded-full bg-white shadow-xs"></div>
                        </button>
                        <span className={`text-[11px] font-bold ${pkg.isActive ? 'text-emerald-700' : 'text-slate-400'}`}>
                          {pkg.isActive ? 'Aktif' : 'Off'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: SIMULASI STRUK & KALKULASI KASIR INTERAKTIF ─── */}
      {activeTab === 'SIMULATOR' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fadeIn">
          {/* Sisi Kiri: Kontrol Parameter Simulasi */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
            <div>
              <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-emerald-700" />
                <span>Simulator Kalkulasi Kasir POS</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Uji langsung bagaimana rumus Pajak PB1, Biaya Layanan, dan Kemasan otomatis dihitung pada layar checkout kasir.
              </p>
            </div>

            {/* Input Subtotal */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Simulasi Subtotal Belanja Produk
              </label>
              <CurrencyInput
                value={simSubtotal}
                onChange={(num) => setSimSubtotal(num)}
                placeholder="100.000"
                className="w-full"
                inputClassName="text-sm font-black text-slate-900 py-2.5"
              />
              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setSimSubtotal(50000)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700"
                >
                  Rp 50.000
                </button>
                <button
                  type="button"
                  onClick={() => setSimSubtotal(100000)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700"
                >
                  Rp 100.000
                </button>
                <button
                  type="button"
                  onClick={() => setSimSubtotal(250000)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700"
                >
                  Rp 250.000
                </button>
              </div>
            </div>

            {/* Pilih Kanal Penjualan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                Simulasi Saluran Penjualan (Order Channel)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSimChannel('DINE_IN')}
                  className={`p-3 rounded-2xl border text-left text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                    simChannel === 'DINE_IN'
                      ? 'bg-blue-50 border-blue-900 text-blue-950 ring-1 ring-blue-900'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <UtensilsCrossed className="w-4 h-4 text-blue-900 shrink-0" />
                  <div>
                    <div>Makan di Tempat</div>
                    <div className="text-[10px] text-slate-400 font-normal">Dine In (Service Charge)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSimChannel('TAKEAWAY')}
                  className={`p-3 rounded-2xl border text-left text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                    simChannel === 'TAKEAWAY'
                      ? 'bg-blue-50 border-blue-900 text-blue-950 ring-1 ring-blue-900'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <ShoppingBag className="w-4 h-4 text-blue-900 shrink-0" />
                  <div>
                    <div>Bawa Pulang</div>
                    <div className="text-[10px] text-slate-400 font-normal">Takeaway (Kemasan)</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSimChannel('DELIVERY')}
                  className={`p-3 rounded-2xl border text-left text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                    simChannel === 'DELIVERY'
                      ? 'bg-blue-50 border-blue-900 text-blue-950 ring-1 ring-blue-900'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Bike className="w-4 h-4 text-blue-900 shrink-0" />
                  <div>
                    <div>Kurir Toko</div>
                    <div className="text-[10px] text-slate-400 font-normal">Delivery Langsung</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSimChannel('ONLINE_DELIVERY')}
                  className={`p-3 rounded-2xl border text-left text-xs font-bold transition-all flex items-center gap-2.5 cursor-pointer ${
                    simChannel === 'ONLINE_DELIVERY'
                      ? 'bg-blue-50 border-blue-900 text-blue-950 ring-1 ring-blue-900'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Globe className="w-4 h-4 text-blue-900 shrink-0" />
                  <div>
                    <div>Mitra Online</div>
                    <div className="text-[10px] text-slate-400 font-normal">GoFood / Grab / Shopee</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Checklist Kemasan yang Ditambahkan */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Simulasi Kemasan yang Dipilih Kasir
              </label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {packagingFees.map((pkg) => (
                  <label
                    key={pkg.id}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium cursor-pointer hover:bg-slate-100"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={simSelectedPackaging.includes(pkg.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSimSelectedPackaging((prev) => [...prev, pkg.id]);
                          } else {
                            setSimSelectedPackaging((prev) => prev.filter((id) => id !== pkg.id));
                          }
                        }}
                        className="rounded text-blue-900 focus:ring-blue-900"
                      />
                      <span>{pkg.name}</span>
                    </div>
                    <span className="font-bold text-slate-800">{formatRupiah(pkg.rate)}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Sisi Kanan: Tampilan Struk Kasir Nyata */}
          <div className="lg:col-span-6 bg-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
                <div>
                  <h4 className="font-black text-sm tracking-wide text-white">
                    PRATINJAU STRUK TRANSAKSI
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Kanal: {simChannel.replace('_', ' ')}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800">
                  Live Calculator
                </span>
              </div>

              {/* Rincian Angka */}
              <div className="space-y-2 text-xs font-semibold">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Subtotal Menu &amp; Produk</span>
                  <span>{formatRupiah(simulationResults.subtotal)}</span>
                </div>

                {simulationResults.serviceChargeAmount > 0 && (
                  <div className="flex items-center justify-between text-emerald-400">
                    <span>
                      {serviceFees.find(
                        (s) =>
                          s.isActive &&
                          (s.id === 'fee_service' ||
                            s.name.toLowerCase().includes('layanan') ||
                            s.name.toLowerCase().includes('service'))
                      )?.name || 'Biaya Layanan'}
                      {(() => {
                        const activeSvc = serviceFees.find(
                          (s) =>
                            s.isActive &&
                            (s.id === 'fee_service' ||
                              s.name.toLowerCase().includes('layanan') ||
                              s.name.toLowerCase().includes('service'))
                        );
                        return activeSvc?.type === 'PERCENTAGE'
                          ? ` (${activeSvc.rate}%)`
                          : '';
                      })()}
                    </span>
                    <span>+{formatRupiah(simulationResults.serviceChargeAmount)}</span>
                  </div>
                )}

                {simulationResults.otherFeesAmount > 0 && (
                  <div className="flex items-center justify-between text-purple-400">
                    <span>Biaya Pengantaran / Platform</span>
                    <span>+{formatRupiah(simulationResults.otherFeesAmount)}</span>
                  </div>
                )}

                {simulationResults.packagingAmount > 0 && (
                  <div className="flex items-center justify-between text-amber-400">
                    <span>Kemasan &amp; Wadah Takeaway</span>
                    <span>+{formatRupiah(simulationResults.packagingAmount)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-blue-300">
                  <span>
                    {primaryTax.name} ({primaryTax.rate}%)
                    {primaryTax.isActive ? '' : ' [Non-aktif]'}
                  </span>
                  <span>
                    {primaryTax.isActive ? `+${formatRupiah(simulationResults.taxAmount)}` : 'Rp 0'}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-3 flex items-center justify-between">
                <span className="text-sm font-black text-white">TOTAL HARGA KASIR</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-400">
                  {formatRupiah(simulationResults.grandTotal)}
                </span>
              </div>
            </div>

            {/* Split Akuntansi Bisnis (Transparansi Resto vs Pemda) */}
            <div className="p-4 bg-slate-800/80 rounded-2xl border border-slate-700/80 space-y-2 text-xs">
              <div className="font-bold text-slate-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <span>Pemisahan Alokasi Dana:</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>💰 Masuk Kas / Omzet Restoran:</span>
                <strong className="text-white">{formatRupiah(simulationResults.merchantNetIncome)}</strong>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>🏛️ Titipan Pajak Pemda (PB1):</span>
                <strong className="text-blue-300">{formatRupiah(simulationResults.taxAmount)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Supervisor Fees Modal (Cadangan PIN SPV Kasir) */}
      {activeOutlet && feesModalOpen && (
        <SupervisorFeesModal
          isOpen={feesModalOpen}
          onClose={() => setFeesModalOpen(false)}
          outlet={activeOutlet}
          onSaved={(updated) => {
            setFees(updated);
            if (onOutletUpdated) onOutletUpdated({ ...activeOutlet, feesConfig: updated });
          }}
          isDirectAuthorized={
            currentUserRole === 'OWNER' ||
            currentUserRole === 'ADMIN' ||
            currentUserRole === 'SUPERVISOR'
          }
          currentUserRole={currentUserRole}
        />
      )}
    </div>
  );
};
