import React, { useState, useEffect } from 'react';
import {
  X,
  Shield,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Lock,
  Sliders,
  ShoppingBag,
  Building2,
  Star,
  Edit2,
  Check,
  Utensils,
} from 'lucide-react';
import type { Outlet, OutletFee, FeeType, FeeChannelScope, FeeCategory } from '../types/outlet';
import { normalizeOutletFees } from '../types/outlet';
import { api } from '../services/api';
import { CurrencyInput } from './ui/CurrencyInput';
import { useDialog } from '../context/DialogContext';

interface SupervisorFeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  outlet: Outlet;
  onSaved: (updatedFees: OutletFee[]) => void;
  isDirectAuthorized?: boolean; // True if opened by Admin/Owner directly without PIN
  currentUserRole?: string;
  initialTab?: 'TAX' | 'SERVICE' | 'PACKAGING';
}

export const SupervisorFeesModal: React.FC<SupervisorFeesModalProps> = ({
  isOpen,
  onClose,
  outlet,
  onSaved,
  isDirectAuthorized = false,
  currentUserRole,
  initialTab = 'TAX',
}) => {
  const dialog = useDialog();
  const isRoleDirect =
    isDirectAuthorized ||
    currentUserRole === 'ADMIN' ||
    currentUserRole === 'OWNER' ||
    currentUserRole === 'SUPERVISOR';

  // Authorization State
  const [pinAuthorized, setPinAuthorized] = useState(isRoleDirect);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Active Sub-tab in Modal: Tax vs Service vs Packaging
  const [activeTab, setActiveTab] = useState<'TAX' | 'SERVICE' | 'PACKAGING'>('TAX');

  // Fees State
  const [fees, setFees] = useState<OutletFee[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New Fee Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFeeName, setNewFeeName] = useState('');
  const [newFeeType, setNewFeeType] = useState<FeeType>('PERCENTAGE');
  const [newFeeRate, setNewFeeRate] = useState<number>(10);
  const [newFeeChannel, setNewFeeChannel] = useState<FeeChannelScope>('ALL');

  // Inline Title Editing (feeId being edited)
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editTitleValue, setEditTitleValue] = useState<string>('');

  // Delete Fee State (Hoisted to top to strictly preserve Hook call order)
  const [feeToDelete, setFeeToDelete] = useState<OutletFee | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPinAuthorized(isRoleDirect);
      setPinInput('');
      setPinError(null);
      setSaveSuccess(false);
      setErrorMessage(null);
      setShowAddForm(false);
      setEditingTitleId(null);
      setFeeToDelete(null);
      setActiveTab(initialTab || 'TAX');

      setFees(normalizeOutletFees(outlet.feesConfig));
    }
  }, [isOpen, outlet, isDirectAuthorized, initialTab]);

  // Handle PIN verification
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput.trim()) return;

    const validPins = ['222111', '999222', '111222', '999111'];
    if (validPins.includes(pinInput.trim())) {
      setPinAuthorized(true);
      setPinError(null);
    } else {
      setPinError('PIN Supervisor tidak sesuai. Silakan coba lagi.');
    }
  };

  // Toggle Fee Active / Inactive
  const toggleFeeActive = (feeId: string) => {
    setFees((prev) =>
      prev.map((f) => (f.id === feeId ? { ...f, isActive: !f.isActive } : f))
    );
  };

  // Toggle Quick Access for On-Demand items
  const toggleQuickAccess = (feeId: string) => {
    const fee = fees.find((f) => f.id === feeId);
    if (!fee) return;

    if (!fee.isQuickAccess) {
      // Check current quick access count
      const activeQuickCount = fees.filter(
        (f) => f.category === 'ON_DEMAND_PACKAGING' && f.isQuickAccess
      ).length;
      if (activeQuickCount >= 4) {
        dialog.alert({
          title: 'Batas Akses Cepat',
          message: 'Maksimal 4 kemasan/biaya yang dapat dipin ke Akses Cepat Keranjang Kasir.',
          variant: 'warning',
        });
        return;
      }
    }

    setFees((prev) =>
      prev.map((f) => (f.id === feeId ? { ...f, isQuickAccess: !f.isQuickAccess } : f))
    );
  };

  // Start Title Edit
  const startEditTitle = (fee: OutletFee) => {
    setEditingTitleId(fee.id);
    setEditTitleValue(fee.name);
  };

  // Save Title Edit
  const saveEditTitle = (feeId: string) => {
    if (!editTitleValue.trim()) return;
    setFees((prev) =>
      prev.map((f) => (f.id === feeId ? { ...f, name: editTitleValue.trim() } : f))
    );
    setEditingTitleId(null);
  };

  // Update Fee Rate
  const updateFeeRate = (feeId: string, rate: number) => {
    setFees((prev) =>
      prev.map((f) => (f.id === feeId ? { ...f, rate: Math.max(0, rate) } : f))
    );
  };

  // Update Channel Scope
  const updateFeeChannel = (feeId: string, scope: FeeChannelScope) => {
    setFees((prev) =>
      prev.map((f) => (f.id === feeId ? { ...f, channelScope: scope } : f))
    );
  };

  // Delete Fee via ConfirmModal
  const executeDeleteFee = () => {
    if (feeToDelete) {
      setFees((prev) => prev.filter((f) => f.id !== feeToDelete.id));
      setFeeToDelete(null);
    }
  };

  // Add New Fee
  const handleAddNewFee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeeName.trim()) return;

    const isTaxTab = activeTab === 'TAX';
    const isServiceTab = activeTab === 'SERVICE';
    const category: FeeCategory = activeTab === 'PACKAGING' ? 'ON_DEMAND_PACKAGING' : 'DEFAULT_TAX_SERVICE';
    const type: FeeType = activeTab === 'PACKAGING' ? 'FIXED' : newFeeType;

    const newFee: OutletFee = {
      id: `fee_${Date.now()}`,
      name: newFeeName.trim(),
      type,
      rate: Number(newFeeRate),
      channelScope: newFeeChannel,
      isActive: true,
      category,
      isQuickAccess: activeTab === 'PACKAGING',
    };

    setFees((prev) => [...prev, newFee]);
    setNewFeeName('');
    setNewFeeRate(isTaxTab ? 10 : isServiceTab ? 5 : 1000);
    setShowAddForm(false);
  };

  // Save to backend
  const handleSave = async () => {
    setSaving(true);
    setErrorMessage(null);
    try {
      const res = await api.updateOutletFees(
        outlet.id,
        fees,
        pinInput.trim() || undefined
      );

      if (res.status === 'success') {
        setSaveSuccess(true);
        onSaved(fees);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setErrorMessage(res.message || 'Gagal menyimpan perubahan biaya');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Terjadi kesalahan saat menyimpan biaya');
    } finally {
      setSaving(false);
    }
  };

  // Helper filtering kanonikal
  const isTax = (f: OutletFee) =>
    f.id === 'fee_tax' ||
    (f.category === 'DEFAULT_TAX_SERVICE' &&
      (f.name.toLowerCase().includes('pajak') ||
        f.name.toLowerCase().includes('pb1') ||
        f.name.toLowerCase().includes('ppn') ||
        f.name.toLowerCase().includes('pbjt')));
  const isService = (f: OutletFee) => f.category !== 'ON_DEMAND_PACKAGING' && !isTax(f);
  const isPackaging = (f: OutletFee) => f.category === 'ON_DEMAND_PACKAGING';

  // Filtered by active tab
  const taxFees = fees.filter(isTax);
  const serviceFees = fees.filter(isService);
  const packagingFees = fees.filter(isPackaging);
  const displayedFees =
    activeTab === 'TAX'
      ? taxFees
      : activeTab === 'SERVICE'
      ? serviceFees
      : packagingFees;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        {/* Header Modal */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-950 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-800/80 border border-blue-700/60 flex items-center justify-center text-blue-200 shadow-xs shrink-0">
              <Shield className="w-5 h-5 text-emerald-400 shrink-0" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight text-white truncate">
                  Kelola Biaya Toko &amp; Kemasan
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-800 border border-blue-600 text-blue-200 shrink-0">
                  SPV / Owner
                </span>
              </div>
              <p className="text-xs text-blue-200/90 font-medium truncate">
                Outlet Toko: <span className="text-white font-bold">{outlet.name}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PIN Authorization Screen (If Kasir without Owner direct access) */}
        {!pinAuthorized ? (
          <div className="p-6 sm:p-8 space-y-6 flex-1 overflow-y-auto">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 mx-auto flex items-center justify-center shadow-xs shrink-0">
                <Lock className="w-6 h-6 shrink-0" />
              </div>
              <h4 className="text-base font-extrabold text-slate-900">
                Otorisasi Supervisor Dibutuhkan
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Pengaturan pajak, biaya layanan, dan tarif kemasan hanya dapat diubah dengan izin Supervisor atau Owner.
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-4 max-w-xs mx-auto">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 text-center">
                  Masukkan PIN Supervisor (Contoh PRO: 222111)
                </label>
                <input
                  type="password"
                  maxLength={6}
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="******"
                  className="w-full text-center text-2xl tracking-[0.5em] font-mono font-black py-2.5 px-4 bg-slate-50 border-2 border-slate-300 focus:border-blue-900 rounded-2xl outline-none"
                />
              </div>

              {pinError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      if (k === 'C') setPinInput('');
                      else if (k === 'OK') handlePinSubmit({ preventDefault: () => {} } as any);
                      else if (pinInput.length < 6) setPinInput((prev) => prev + k);
                    }}
                    className={`py-3 rounded-xl font-black text-sm transition-all ${
                      k === 'OK'
                        ? 'bg-blue-900 text-white hover:bg-blue-800'
                        : k === 'C'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-100 shadow-xs'
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </form>
          </div>
        ) : (
          /* Main Tabbed Fee Configuration Screen */
          <div className="flex-1 flex flex-col min-h-0">
            {/* 3 Tabs Header: Pajak vs Layanan vs Kemasan */}
            <div className="p-2 bg-slate-100 border-b border-slate-200 flex gap-1.5 shrink-0 overflow-x-auto">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('TAX');
                  setShowAddForm(false);
                }}
                className={`flex-1 py-2.5 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'TAX'
                    ? 'bg-white text-blue-950 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 text-blue-900" />
                <span>Pajak (PB1)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-900 font-extrabold">
                  {taxFees.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('SERVICE');
                  setShowAddForm(false);
                }}
                className={`flex-1 py-2.5 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'SERVICE'
                    ? 'bg-white text-emerald-950 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Utensils className="w-3.5 h-3.5 text-emerald-600" />
                <span>Biaya Layanan &amp; Kurir</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-900 font-extrabold">
                  {serviceFees.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('PACKAGING');
                  setShowAddForm(false);
                }}
                className={`flex-1 py-2.5 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  activeTab === 'PACKAGING'
                    ? 'bg-white text-amber-950 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                <span>Kemasan Kasir</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 font-extrabold">
                  {packagingFees.length}
                </span>
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto">
              {/* Context info banner */}
              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 text-blue-950 text-xs flex items-start gap-2.5">
                <Sliders className="w-4 h-4 text-blue-900 mt-0.5 shrink-0" />
                <div>
                  <span className="font-bold">
                    {activeTab === 'TAX'
                      ? 'Pajak Daerah Restoran (PB1 / PBJT):'
                      : activeTab === 'SERVICE'
                      ? 'Biaya Layanan & Operasional Restoran:'
                      : 'Kemasan & Wadah Bawa Pulang (On-Demand):'}
                  </span>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">
                    {activeTab === 'TAX'
                      ? 'Pajak dipungut otomatis saat checkout dan disetorkan ke Bapenda (bukan hak/omzet restoran).'
                      : activeTab === 'SERVICE'
                      ? 'Biaya operasional tambahan yang menjadi pendapatan toko (Service Charge, Ongkir Kurir Toko, Platform).'
                      : 'Biaya kemasan dipilih kasir sesuai pesanan. Tandai ⭐ Akses Cepat pada 4 kemasan terfavorit untuk tampil di keranjang kasir.'}
                  </p>
                </div>
              </div>

              {/* Error & Success Messages */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {saveSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Perubahan konfigurasi biaya toko berhasil disimpan!</span>
                </div>
              )}

              {/* Fee Items List */}
              <div className="space-y-3">
                {displayedFees.map((fee) => (
                  <div
                    key={fee.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      fee.isActive
                        ? 'bg-white border-blue-300 shadow-xs'
                        : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Title Display or Edit Mode */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {editingTitleId === fee.id ? (
                            <div className="flex items-center gap-1.5 w-full max-w-sm">
                              <input
                                type="text"
                                value={editTitleValue}
                                onChange={(e) => setEditTitleValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEditTitle(fee.id);
                                  if (e.key === 'Escape') setEditingTitleId(null);
                                }}
                                className="flex-1 px-2.5 py-1 bg-white border-2 border-blue-900 rounded-lg text-xs font-bold text-blue-950 outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => saveEditTitle(fee.id)}
                                className="p-1 rounded-lg bg-blue-900 text-white hover:bg-blue-800"
                                title="Simpan Judul"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingTitleId(null)}
                                className="p-1 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300"
                                title="Batal"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 group">
                              <span className="font-bold text-sm text-blue-950 truncate">
                                {fee.name}
                              </span>
                              <button
                                type="button"
                                onClick={() => startEditTitle(fee)}
                                title="Ubah Nama Judul Biaya"
                                className="p-1 text-slate-400 hover:text-blue-900 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}

                          {/* Category / Scope Badge */}
                          {fee.category === 'DEFAULT_TAX_SERVICE' ? (
                            <select
                              value={fee.channelScope}
                              onChange={(e) =>
                                updateFeeChannel(fee.id, e.target.value as FeeChannelScope)
                              }
                              className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-slate-700 outline-none cursor-pointer"
                            >
                              <option value="ALL">Semua Saluran</option>
                              <option value="DINE_IN">Makan di Tempat (Dine In)</option>
                              <option value="TAKEAWAY">Bawa Pulang (Take Away)</option>
                              <option value="DELIVERY">Kurir Toko (Delivery)</option>
                              <option value="ONLINE_DELIVERY">Semua Mitra Online</option>
                              <option value="GOFOOD">Khusus GoFood</option>
                              <option value="GRABFOOD">Khusus GrabFood</option>
                              <option value="SHOPEEFOOD">Khusus ShopeeFood</option>
                            </select>
                          ) : (
                            fee.isQuickAccess && (
                              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-amber-900 flex items-center gap-1 shadow-2xs">
                                <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-600" />
                                <span>Akses Cepat</span>
                              </span>
                            )
                          )}
                        </div>

                        {/* Rate / Tarif modifier */}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <div className="flex items-center gap-1.5 text-xs text-slate-600">
                            <span className="font-medium">Tarif / Harga:</span>
                            {fee.type === 'FIXED' ? (
                              <div className="w-32">
                                <CurrencyInput
                                  value={fee.rate}
                                  onChange={(val) => updateFeeRate(fee.id, val)}
                                  inputClassName="py-1 text-xs font-bold text-right pl-14 rounded-lg"
                                  prefixClassName="text-[10px] py-0.5 px-1.5"
                                  placeholder="0"
                                />
                              </div>
                            ) : (
                              <>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={fee.rate}
                                  onChange={(e) => updateFeeRate(fee.id, Number(e.target.value))}
                                  className="w-20 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-950 focus:border-blue-900 outline-none"
                                />
                                <span className="font-extrabold text-blue-900">%</span>
                              </>
                            )}
                            {fee.category === 'ON_DEMAND_PACKAGING' && (
                              <span className="text-slate-400 text-[11px]">/ pcs</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action buttons (Pin Quick Access, Toggle Active, Delete) */}
                      <div className="flex items-center gap-2 shrink-0">
                        {fee.category === 'ON_DEMAND_PACKAGING' && (
                          <button
                            type="button"
                            onClick={() => toggleQuickAccess(fee.id)}
                            title={
                              fee.isQuickAccess
                                ? 'Lepas dari 4 Akses Cepat Keranjang'
                                : 'Pin ke 4 Akses Cepat Keranjang'
                            }
                            className={`p-1.5 rounded-lg border transition-all ${
                              fee.isQuickAccess
                                ? 'bg-amber-50 border-amber-300 text-amber-600 shadow-2xs'
                                : 'bg-white border-slate-200 text-slate-400 hover:text-amber-500'
                            }`}
                          >
                            <Star
                              className={`w-4 h-4 ${fee.isQuickAccess ? 'fill-amber-500' : ''}`}
                            />
                          </button>
                        )}

                        {/* Toggle On/Off Switch */}
                        <button
                          type="button"
                          onClick={() => toggleFeeActive(fee.id)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            fee.isActive ? 'bg-emerald-600' : 'bg-slate-300'
                          }`}
                          title={fee.isActive ? 'Nonaktifkan Biaya' : 'Aktifkan Biaya'}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              fee.isActive ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>

                        {/* Delete button (bisa hapus semua biaya kecuali pajak utama) */}
                        {fee.id !== 'fee_tax' && (
                          feeToDelete?.id === fee.id ? (
                            <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 rounded-lg p-1 animate-fadeIn">
                              <span className="text-[10px] font-bold text-rose-700 px-1">Hapus?</span>
                              <button
                                type="button"
                                onClick={executeDeleteFee}
                                className="px-2 py-0.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[11px] font-bold shadow-2xs cursor-pointer"
                              >
                                Ya
                              </button>
                              <button
                                type="button"
                                onClick={() => setFeeToDelete(null)}
                                className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[11px] font-bold cursor-pointer"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setFeeToDelete(fee)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                              title="Hapus Biaya"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Form Tambah Biaya Baru */}
              {showAddForm ? (
                <form
                  onSubmit={handleAddNewFee}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-300 space-y-3 animate-fadeIn"
                >
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-xs text-blue-950 uppercase tracking-wider">
                      {activeTab === 'TAX'
                        ? '+ Tambah Komponen Pajak Daerah Baru'
                        : activeTab === 'SERVICE'
                        ? '+ Tambah Biaya Layanan / Kurir Baru'
                        : '+ Tambah Kemasan / Biaya On-Demand Baru'}
                    </h5>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-slate-400 hover:text-slate-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {activeTab === 'TAX'
                        ? 'Nama Komponen Pajak'
                        : activeTab === 'SERVICE'
                        ? 'Nama Biaya Layanan / Operasional'
                        : 'Nama Kemasan / Wadah Kasir'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={
                        activeTab === 'TAX'
                          ? 'Contoh: PB1 Pajak Restoran Daerah 10%'
                          : activeTab === 'SERVICE'
                          ? 'Contoh: Service Charge Meja, Ongkir Kurir Toko'
                          : 'Contoh: Kantong Plastik Jumbo, Box Dus Besar'
                      }
                      value={newFeeName}
                      onChange={(e) => setNewFeeName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium outline-none focus:border-blue-900"
                    />
                  </div>

                  <div className={`grid ${activeTab !== 'PACKAGING' ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                    {activeTab !== 'PACKAGING' ? (
                      <>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Tipe Perhitungan
                          </label>
                          <select
                            value={newFeeType}
                            onChange={(e) => setNewFeeType(e.target.value as FeeType)}
                            className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium outline-none"
                          >
                            <option value="PERCENTAGE">Persentase (%)</option>
                            <option value="FIXED">Nominal Tetap (Rp)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Saluran Layanan
                          </label>
                          <select
                            value={newFeeChannel}
                            onChange={(e) => setNewFeeChannel(e.target.value as FeeChannelScope)}
                            className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium outline-none"
                          >
                            <option value="ALL">Semua Saluran</option>
                            <option value="DINE_IN">Makan di Tempat (Dine In)</option>
                            <option value="TAKEAWAY">Bawa Pulang (Take Away)</option>
                            <option value="DELIVERY">Kurir Toko (Delivery)</option>
                            <option value="ONLINE_DELIVERY">Semua Mitra Online</option>
                            <option value="GOFOOD">Khusus GoFood</option>
                            <option value="GRABFOOD">Khusus GrabFood</option>
                            <option value="SHOPEEFOOD">Khusus ShopeeFood</option>
                          </select>
                        </div>
                      </>
                    ) : (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Kategori
                        </label>
                        <input
                          type="text"
                          disabled
                          value="Kemasan On-Demand (Fixed Rp)"
                          className="w-full px-2.5 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 outline-none"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {activeTab !== 'PACKAGING'
                          ? `Tarif (${newFeeType === 'PERCENTAGE' ? '%' : 'Rp'})`
                          : 'Harga per Pcs (Rp)'}
                      </label>
                      {activeTab !== 'PACKAGING' && newFeeType === 'PERCENTAGE' ? (
                        <div className="relative flex items-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            required
                            value={newFeeRate}
                            onChange={(e) => setNewFeeRate(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-blue-900 pr-8"
                          />
                          <span className="absolute right-3 font-black text-blue-900 text-xs">%</span>
                        </div>
                      ) : (
                        <CurrencyInput
                          value={newFeeRate}
                          onChange={(val) => setNewFeeRate(val)}
                          inputClassName="py-2 text-xs font-bold text-right"
                          placeholder="0"
                          required
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold shadow-xs"
                    >
                      Tambahkan
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(true);
                    setNewFeeName('');
                    setNewFeeRate(activeTab === 'TAX' ? 10 : activeTab === 'SERVICE' ? 5 : 1000);
                  }}
                  className="w-full py-2.5 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-slate-600 hover:text-blue-900 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {activeTab === 'TAX'
                      ? 'Tambah Komponen Pajak Baru'
                      : activeTab === 'SERVICE'
                      ? 'Tambah Biaya Layanan / Kurir Baru'
                      : 'Tambah Jenis Kemasan / Biaya On-Demand Baru'}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer Actions */}
        {pinAuthorized && (
          <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors"
            >
              Tutup
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs sm:text-sm font-extrabold shadow-md shadow-blue-900/20 active:scale-98 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                'Menyimpan...'
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Simpan Semua Perubahan</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
