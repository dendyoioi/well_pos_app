import React, { useState, useEffect } from 'react';
import { X, Package, AlertCircle, Save, Loader2, ChevronDown, Calculator, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import { CurrencyInput } from '../ui/CurrencyInput';
import type { RecipeInventoryItem } from '../../types/recipe';

interface CreateIngredientModalProps {
  isOpen: boolean;
  onClose: () => void;
  outletId?: string;
  onSuccess: () => void;
  isLaundryMode?: boolean;
  initialData?: RecipeInventoryItem | null;
}

const PURCHASE_UOM_PRESETS = [
  'JERIGEN',
  'BOTOL',
  'SAK',
  'DUS',
  'KARTON',
  'PACK',
  'GALON',
  'DRUM',
  'PAIL',
  'BALL',
];

export const CreateIngredientModal: React.FC<CreateIngredientModalProps> = ({
  isOpen,
  onClose,
  outletId,
  onSuccess,
  isLaundryMode = false,
  initialData = null,
}) => {
  const [name, setName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [canonicalUom, setCanonicalUom] = useState(isLaundryMode ? 'ML' : 'GRAM');
  const [purchaseUom, setPurchaseUom] = useState(isLaundryMode ? 'JERIGEN' : 'PACK');
  const [purchaseConversionFactor, setPurchaseConversionFactor] = useState<number>(isLaundryMode ? 4500 : 1000);
  const [averageCost, setAverageCost] = useState<number>(0);
  const [initialStock, setInitialStock] = useState<number>(0);
  const [reorderPoint, setReorderPoint] = useState<number>(100);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (initialData) {
      setName(initialData.name || '');
      setItemCode(initialData.itemCode || '');
      setCanonicalUom(initialData.canonicalUom || (isLaundryMode ? 'ML' : 'GRAM'));
      setPurchaseUom(initialData.purchaseUom || (isLaundryMode ? 'JERIGEN' : 'PACK'));
      setPurchaseConversionFactor(Number(initialData.purchaseConversionFactor || 1));
      setAverageCost(Number(initialData.averageCost || 0));
      setReorderPoint(Number(initialData.reorderPoint || 100));
      setInitialStock(0);
    } else {
      setName('');
      setItemCode('');
      setCanonicalUom(isLaundryMode ? 'ML' : 'GRAM');
      setPurchaseUom(isLaundryMode ? 'JERIGEN' : 'PACK');
      setPurchaseConversionFactor(isLaundryMode ? 4500 : 1000);
      setAverageCost(0);
      setInitialStock(0);
      setReorderPoint(100);
    }
    setErrorMsg('');
  }, [initialData, isOpen, isLaundryMode]);

  if (!isOpen) return null;

  // Preset konversi cepat
  const applyPreset = (pUom: string, factor: number, cUom?: string) => {
    setPurchaseUom(pUom);
    setPurchaseConversionFactor(factor);
    if (cUom) setCanonicalUom(cUom);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg(isLaundryMode ? 'Nama bahan cuci wajib diisi' : 'Nama bahan baku wajib diisi');
      return;
    }

    const factor = Number(purchaseConversionFactor) > 0 ? Number(purchaseConversionFactor) : 1;

    setSubmitting(true);
    setErrorMsg('');

    try {
      if (initialData?.id) {
        // Mode Edit / Update
        const res = await api.updateInventoryItem(initialData.id, {
          name: name.trim(),
          itemCode: itemCode.trim() || undefined,
          canonicalUom,
          purchaseUom: purchaseUom?.trim().toUpperCase() || null,
          purchaseConversionFactor: factor,
          averageCost: Number(averageCost) || 0,
          reorderPoint: Number(reorderPoint) || 0,
        });

        if (res.status === 'success') {
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.message || 'Gagal memperbarui bahan');
        }
      } else {
        // Mode Tambah Baru
        const res = await api.createInventoryItem({
          name: name.trim(),
          itemCode: itemCode.trim() || undefined,
          canonicalUom,
          purchaseUom: purchaseUom?.trim().toUpperCase() || null,
          purchaseConversionFactor: factor,
          averageCost: Number(averageCost) || 0,
          reorderPoint: Number(reorderPoint) || 0,
          initialStock: Number(initialStock) || 0,
          outletId,
        });

        if (res.status === 'success') {
          setName('');
          setItemCode('');
          setAverageCost(0);
          setInitialStock(0);
          setReorderPoint(100);
          onSuccess();
          onClose();
        } else {
          setErrorMsg(res.message || 'Gagal mendaftarkan bahan baku');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  const isEditing = !!initialData?.id;
  const factorNumber = Number(purchaseConversionFactor) || 1;
  const effectiveCostPerPurchaseUom = Math.round(Number(averageCost || 0) * factorNumber);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        {/* Header - Sticky */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-900 flex items-center justify-center shadow-xs shrink-0">
              <Package className="w-5 h-5 shrink-0" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-slate-900 truncate">
                {isEditing
                  ? `Edit Master: ${initialData.name}`
                  : isLaundryMode
                  ? 'Tambah Bahan Cuci & Perlengkapan'
                  : 'Tambah Bahan Baku Baru'}
              </h2>
              <p className="text-xs text-slate-500 font-medium truncate">
                {isLaundryMode
                  ? 'Konversi satuan beli (Jerigen/Sak) ke takaran pakai (ML/Gram)'
                  : 'Daftarkan bahan mentah racikan resep & stok dapur'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center border border-slate-200 transition-all cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Nama Bahan & Kode */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                {isLaundryMode ? 'Nama Bahan Cuci / Perlengkapan' : 'Nama Bahan Baku'} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  isLaundryMode
                    ? 'Contoh: Deterjen Cair Matic, Parfum Lavender, Softener Ultra...'
                    : 'Contoh: Bubuk Kopi Espresso, Susu UHT Fresh...'
                }
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Kode Bahan (Opsional)
                </label>
                <input
                  type="text"
                  value={itemCode}
                  onChange={(e) => setItemCode(e.target.value)}
                  placeholder="Auto jika kosong (RAW-001)"
                  className="w-full h-10 px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 whitespace-nowrap">
                  Satuan Dasar (Takaran Pakai) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={canonicalUom}
                    onChange={(e) => setCanonicalUom(e.target.value)}
                    className="w-full h-10 pl-3.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all appearance-none cursor-pointer"
                  >
                    <option value="ML">ML — Mililiter (Cairan)</option>
                    <option value="GRAM">GRAM — Gram (Bubuk)</option>
                    <option value="PCS">PCS — Satuan (Plastik/Hanger)</option>
                    <option value="LITER">LITER — Liter</option>
                    <option value="KG">KG — Kilogram</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>

            {/* SEKSI: KONVERSI SATUAN BELI (PURCHASE UOM) */}
            <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-blue-900 shrink-0" />
                  <span className="text-xs font-extrabold text-blue-950">
                    Konversi Satuan Pembelian (Kulakan / Belanja Supplier)
                  </span>
                </div>
                <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded-full">
                  BoM Takaran Presisi
                </span>
              </div>

              <p className="text-[11px] text-slate-600 leading-relaxed">
                Tentukan kemasan saat belanja (misal 1 Jerigen) dan berapa isi takaran dasarnya (misal 4.500 ML). Sistem otomatis mengkonversi saat barang masuk.
              </p>

              {/* Chips Preset Cepat */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Pilihan Preset Cepat:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => applyPreset('JERIGEN', 4500, 'ML')}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-blue-100 text-[11px] font-bold text-blue-900 border border-blue-200 transition-all cursor-pointer"
                  >
                    1 Jerigen = 4.500 ML (4,5 Liter)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('JERIGEN', 5000, 'ML')}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-blue-100 text-[11px] font-bold text-blue-900 border border-blue-200 transition-all cursor-pointer"
                  >
                    1 Jerigen = 5.000 ML (5 Liter)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('BOTOL', 1000, 'ML')}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-blue-100 text-[11px] font-bold text-blue-900 border border-blue-200 transition-all cursor-pointer"
                  >
                    1 Botol = 1.000 ML (1 Liter)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('SAK', 25000, 'GRAM')}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-blue-100 text-[11px] font-bold text-blue-900 border border-blue-200 transition-all cursor-pointer"
                  >
                    1 Sak = 25.000 Gram (25 Kg)
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('DUS', 24, 'PCS')}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-blue-100 text-[11px] font-bold text-blue-900 border border-blue-200 transition-all cursor-pointer"
                  >
                    1 Dus = 24 Pcs
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset('PACK', 100, 'PCS')}
                    className="px-2 py-1 rounded-lg bg-white hover:bg-blue-100 text-[11px] font-bold text-blue-900 border border-blue-200 transition-all cursor-pointer"
                  >
                    1 Pack = 100 Pcs
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Satuan Beli Kemasan (Purchase UoM)
                  </label>
                  <input
                    type="text"
                    value={purchaseUom}
                    onChange={(e) => setPurchaseUom(e.target.value.toUpperCase())}
                    placeholder="Contoh: JERIGEN, BOTOL, SAK, DUS..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 uppercase"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {PURCHASE_UOM_PRESETS.slice(0, 6).map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setPurchaseUom(preset)}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer ${
                          purchaseUom === preset
                            ? 'bg-blue-900 text-white'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Faktor Konversi ke Base Unit
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      min="0.0001"
                      value={purchaseConversionFactor}
                      onChange={(e) => setPurchaseConversionFactor(Number(e.target.value))}
                      placeholder="1"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                      {canonicalUom}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Isi per 1 {purchaseUom || 'Satuan Beli'}
                  </p>
                </div>
              </div>

              {/* Banner Review Konversi */}
              <div className="p-2.5 bg-white rounded-xl border border-blue-200/80 flex items-center justify-between text-xs font-semibold text-blue-950">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-800 shrink-0" />
                  <span>
                    Formula: <b>1 {purchaseUom || 'Satuan Beli'}</b> ={' '}
                    <b>{factorNumber.toLocaleString('id-ID')} {canonicalUom}</b>
                  </span>
                </div>
                {averageCost > 0 && factorNumber > 1 && (
                  <span className="text-[11px] font-bold text-emerald-700 font-mono">
                    Rp {effectiveCostPerPurchaseUom.toLocaleString('id-ID')} / {purchaseUom}
                  </span>
                )}
              </div>
            </div>

            {/* HPP & Reorder Point */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Estimasi Biaya Dasar (HPP per {canonicalUom})
                </label>
                <CurrencyInput
                  value={averageCost}
                  onChange={(val) => setAverageCost(val)}
                  placeholder="0"
                  className="w-full"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Biaya modal per takaran pemakaian cucian
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Batas Alert Stok Minimum ({canonicalUom})
                </label>
                <input
                  type="number"
                  min="0"
                  value={reorderPoint}
                  onChange={(e) => setReorderPoint(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Batas peringatan saat stok mulai menipis
                </p>
              </div>
            </div>

            {/* Saldo Stok Awal (hanya saat tambah baru) */}
            {!isEditing && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Saldo Stok Awal di Outlet Toko ({canonicalUom})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={initialStock}
                    onChange={(e) => setInitialStock(Number(e.target.value))}
                    placeholder="0 jika belum ada fisik di workshop/gudang"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                    {canonicalUom}
                  </span>
                </div>
                {factorNumber > 1 && initialStock > 0 && (
                  <p className="text-[11px] text-blue-700 font-semibold mt-1">
                    Setara dengan {(initialStock / factorNumber).toFixed(2)} {purchaseUom}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons - Sticky Bottom with Safe Area */}
          <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-95 text-white text-xs font-bold shadow-md shadow-blue-900/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>{isEditing ? 'Perbarui Bahan' : 'Simpan Bahan'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
