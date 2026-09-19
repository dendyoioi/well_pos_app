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
} from 'lucide-react';
import type { Outlet, OutletFee, FeeType, FeeChannelScope, FeeCategory } from '../types/outlet';
import { api } from '../services/api';
import { ConfirmModal } from './ConfirmModal';

interface SupervisorFeesModalProps {
  isOpen: boolean;
  onClose: () => void;
  outlet: Outlet;
  onSaved: (updatedFees: OutletFee[]) => void;
  isDirectAuthorized?: boolean; // True if opened by Admin/Owner directly without PIN
  currentUserRole?: string;
}

export const SupervisorFeesModal: React.FC<SupervisorFeesModalProps> = ({
  isOpen,
  onClose,
  outlet,
  onSaved,
  isDirectAuthorized = false,
  currentUserRole,
}) => {
  const isRoleDirect =
    isDirectAuthorized ||
    currentUserRole === 'ADMIN' ||
    currentUserRole === 'OWNER' ||
    currentUserRole === 'SUPERVISOR';

  // Authorization State
  const [pinAuthorized, setPinAuthorized] = useState(isRoleDirect);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  // Active Sub-tab in Modal: Tax & Service (Automatic) vs Packaging & On-Demand (Manual Kasir)
  const [activeTab, setActiveTab] = useState<'TAX_SERVICE' | 'ON_DEMAND'>('TAX_SERVICE');

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

  useEffect(() => {
    if (isOpen) {
      setPinAuthorized(isRoleDirect);
      setPinInput('');
      setPinError(null);
      setSaveSuccess(false);
      setErrorMessage(null);
      setShowAddForm(false);
      setEditingTitleId(null);

      if (outlet.feesConfig && Array.isArray(outlet.feesConfig) && outlet.feesConfig.length > 0) {
        // Normalize categories & quickAccess for backward compatibility
        const normalized: OutletFee[] = outlet.feesConfig.map((f, idx) => {
          const isTaxOrService =
            f.type === 'PERCENTAGE' || ['fee_tax', 'fee_service'].includes(f.id);
          const category: FeeCategory =
            f.category || (isTaxOrService ? 'DEFAULT_TAX_SERVICE' : 'ON_DEMAND_PACKAGING');
          const isQuickAccess =
            f.isQuickAccess !== undefined
              ? f.isQuickAccess
              : category === 'ON_DEMAND_PACKAGING' && idx <= 3;
          return {
            ...f,
            category,
            isQuickAccess,
          };
        });
        setFees(normalized);
      } else {
        // Default standard initial fees
        setFees([
          {
            id: 'fee_tax',
            name: 'PPN / PB1 Pajak',
            type: 'PERCENTAGE',
            rate: 10,
            channelScope: 'ALL',
            isActive: true,
            category: 'DEFAULT_TAX_SERVICE',
          },
          {
            id: 'fee_service',
            name: 'Biaya Layanan (Service Charge)',
            type: 'PERCENTAGE',
            rate: 5,
            channelScope: 'DINE_IN',
            isActive: false,
            category: 'DEFAULT_TAX_SERVICE',
          },
          {
            id: 'fee_plastic_s',
            name: 'Plastik / Kresek Sedang',
            type: 'FIXED',
            rate: 500,
            channelScope: 'ALL',
            isActive: true,
            category: 'ON_DEMAND_PACKAGING',
            isQuickAccess: true,
          },
          {
            id: 'fee_box',
            name: 'Box Kemasan / Mika',
            type: 'FIXED',
            rate: 2000,
            channelScope: 'ALL',
            isActive: true,
            category: 'ON_DEMAND_PACKAGING',
            isQuickAccess: true,
          },
          {
            id: 'fee_paperbag',
            name: 'Paper Bag Kraft',
            type: 'FIXED',
            rate: 3000,
            channelScope: 'ALL',
            isActive: true,
            category: 'ON_DEMAND_PACKAGING',
            isQuickAccess: true,
          },
          {
            id: 'fee_cutlery',
            name: 'Set Sendok & Garpu Higienis',
            type: 'FIXED',
            rate: 1000,
            channelScope: 'ALL',
            isActive: true,
            category: 'ON_DEMAND_PACKAGING',
            isQuickAccess: true,
          },
        ]);
      }
    }
  }, [isOpen, outlet, isDirectAuthorized]);

  if (!isOpen) return null;

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
        alert('Maksimal 4 kemasan/biaya yang dapat dipin ke Akses Cepat Keranjang Kasir.');
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

  const [feeToDelete, setFeeToDelete] = useState<OutletFee | null>(null);

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

    const isTaxTab = activeTab === 'TAX_SERVICE';
    const category: FeeCategory = isTaxTab ? 'DEFAULT_TAX_SERVICE' : 'ON_DEMAND_PACKAGING';
    const type: FeeType = isTaxTab ? newFeeType : 'FIXED';

    const newFee: OutletFee = {
      id: `fee_${Date.now()}`,
      name: newFeeName.trim(),
      type,
      rate: Number(newFeeRate),
      channelScope: newFeeChannel,
      isActive: true,
      category,
      isQuickAccess: !isTaxTab, // Default true for new on-demand item if slots available
    };

    setFees((prev) => [...prev, newFee]);
    setNewFeeName('');
    setNewFeeRate(isTaxTab ? 10 : 1000);
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

  // Filtered by active tab
  const taxFees = fees.filter((f) => f.category === 'DEFAULT_TAX_SERVICE');
  const onDemandFees = fees.filter((f) => f.category === 'ON_DEMAND_PACKAGING');
  const displayedFees = activeTab === 'TAX_SERVICE' ? taxFees : onDemandFees;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Modal */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-950 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-800/80 border border-blue-700/60 flex items-center justify-center text-blue-200 shadow-xs">
              <Shield className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                  Kelola Biaya Toko & Kemasan
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-800 border border-blue-600 text-blue-200">
                  SPV / Owner
                </span>
              </div>
              <p className="text-xs text-blue-200/90 font-medium">
                Cabang: <span className="text-white font-bold">{outlet.name}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PIN Authorization Screen (If Kasir without Owner direct access) */}
        {!pinAuthorized ? (
          <div className="p-6 sm:p-8 space-y-6 flex-1 overflow-y-auto">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 mx-auto flex items-center justify-center shadow-xs">
                <Lock className="w-6 h-6" />
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
                  autoFocus
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
            {/* 2 Tabs Header */}
            <div className="p-2 bg-slate-100 border-b border-slate-200 flex gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('TAX_SERVICE');
                  setShowAddForm(false);
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'TAX_SERVICE'
                    ? 'bg-white text-blue-950 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Building2 className="w-4 h-4 text-blue-900" />
                <span>Biaya Toko & Pajak (Otomatis)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-900 font-extrabold">
                  {taxFees.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('ON_DEMAND');
                  setShowAddForm(false);
                }}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                  activeTab === 'ON_DEMAND'
                    ? 'bg-white text-blue-950 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                <span>Kemasan & On-Demand (Manual Kasir)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-900 font-extrabold">
                  {onDemandFees.length}
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
                    {activeTab === 'TAX_SERVICE'
                      ? 'Pajak & Layanan Toko Terhitung Otomatis:'
                      : 'Kemasan & Layanan Tambahan (On-Demand):'}
                  </span>
                  <p className="text-slate-600 mt-0.5 leading-relaxed">
                    {activeTab === 'TAX_SERVICE'
                      ? 'Biaya ini otomatis dihitung dari subtotal produk jika keranjang terisi. Anda dapat mengedit judul nama biaya, tarif %, dan saluran yang berlaku.'
                      : 'Biaya kemasan dipilih kasir sesuai pesanan pelanggan. Tandai ⭐ Akses Cepat pada 4 kemasan terfavorit untuk tampil langsung di depan keranjang kasir.'}
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
                  <span>Perubahan konfigurasi biaya cabang berhasil disimpan!</span>
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
                                autoFocus
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
                              <option value="DINE_IN">Hanya Dine In</option>
                              <option value="TAKEAWAY">Hanya Takeaway</option>
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
                            {fee.type === 'FIXED' && <span className="text-slate-400 font-bold">Rp</span>}
                            <input
                              type="number"
                              min={0}
                              value={fee.rate}
                              onChange={(e) => updateFeeRate(fee.id, Number(e.target.value))}
                              className="w-24 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-blue-950 focus:border-blue-900 outline-none"
                            />
                            {fee.type === 'PERCENTAGE' && (
                              <span className="font-extrabold text-blue-900">%</span>
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

                        {/* Delete button (only custom or on-demand items) */}
                        {!['fee_tax', 'fee_service'].includes(fee.id) && (
                          <button
                            type="button"
                            onClick={() => setFeeToDelete(fee)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Hapus Biaya"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
                      {activeTab === 'TAX_SERVICE'
                        ? '+ Tambah Biaya Toko / Pajak Baru'
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
                      {activeTab === 'TAX_SERVICE'
                        ? 'Nama Biaya / Pajak (Bebas Diedit)'
                        : 'Nama Kemasan / Layanan Tambahan'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={
                        activeTab === 'TAX_SERVICE'
                          ? 'Contoh: PB1 Daerah 10%, Service Charge VIP'
                          : 'Contoh: Kantong Plastik Jumbo, Box Dus Besar, Sendok Kayu'
                      }
                      value={newFeeName}
                      onChange={(e) => setNewFeeName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium outline-none focus:border-blue-900"
                    />
                  </div>

                  <div className={`grid ${activeTab === 'TAX_SERVICE' ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
                    {activeTab === 'TAX_SERVICE' ? (
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
                            <option value="DINE_IN">Dine In</option>
                            <option value="TAKEAWAY">Takeaway</option>
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
                        {activeTab === 'TAX_SERVICE'
                          ? `Tarif (${newFeeType === 'PERCENTAGE' ? '%' : 'Rp'})`
                          : 'Harga per Pcs (Rp)'}
                      </label>
                      <input
                        type="number"
                        min={0}
                        required
                        value={newFeeRate}
                        onChange={(e) => setNewFeeRate(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:border-blue-900"
                      />
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
                    setNewFeeRate(activeTab === 'TAX_SERVICE' ? 10 : 1000);
                  }}
                  className="w-full py-2.5 rounded-2xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-slate-600 hover:text-blue-900 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>
                    {activeTab === 'TAX_SERVICE'
                      ? 'Tambah Biaya Pajak / Layanan Baru'
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

      {/* Modal Konfirmasi Hapus Biaya */}
      <ConfirmModal
        isOpen={feeToDelete !== null}
        onClose={() => setFeeToDelete(null)}
        onConfirm={executeDeleteFee}
        title="Hapus Pengaturan Biaya?"
        message={
          <p>
            Apakah Anda yakin ingin menghapus konfigurasi biaya{' '}
            <strong className="text-blue-950">"{feeToDelete?.name}"</strong>?
          </p>
        }
        confirmText="Hapus Biaya"
        variant="danger"
      />
    </div>
  );
};
