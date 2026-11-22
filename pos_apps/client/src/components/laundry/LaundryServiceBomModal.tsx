import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FlaskConical,
  Plus,
  Trash2,
  Save,
  Loader2,
  ChevronDown,
  AlertCircle,
  Sparkles,
  Info,
} from 'lucide-react';
import { api } from '../../services/api';
import type { LaundryService } from '../../types/laundry';
import type { RecipeInventoryItem } from '../../types/recipe';

interface LaundryServiceBomModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: LaundryService | null;
  onSuccess: () => void;
  outletId?: string;
}

interface BomRow {
  inventoryItemId: string;
  quantityPerUnit: number;
  consumptionBasis: 'PER_UNIT' | 'PER_ORDER';
  notes: string;
}

export const LaundryServiceBomModal: React.FC<LaundryServiceBomModalProps> = ({
  isOpen,
  onClose,
  service,
  onSuccess,
  outletId,
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [availableIngredients, setAvailableIngredients] = useState<RecipeInventoryItem[]>([]);
  const [bomRows, setBomRows] = useState<BomRow[]>([]);

  useEffect(() => {
    if (isOpen && service) {
      loadData();
    }
  }, [isOpen, service?.id]);

  const loadData = async () => {
    if (!service) return;
    setLoading(true);
    setErrorMsg('');

    try {
      // 1. Ambil daftar master bahan baku/cuci toko
      const ingRes = await api.getRecipeInventoryItems(outletId, 'all');
      if (ingRes.status === 'success' && Array.isArray(ingRes.data)) {
        setAvailableIngredients(ingRes.data);
      }

      // 2. Ambil konfigurasi BoM saat ini
      const bomRes = await api.getLaundryServiceBom(service.id);
      if (bomRes.status === 'success' && bomRes.data?.bomItems) {
        const rows: BomRow[] = bomRes.data.bomItems.map((b: any) => ({
          inventoryItemId: b.inventoryItemId,
          quantityPerUnit: Number(b.quantityPerUnit || 0),
          consumptionBasis: (b.consumptionBasis as 'PER_UNIT' | 'PER_ORDER') || 'PER_UNIT',
          notes: b.notes || '',
        }));
        setBomRows(rows);
      } else {
        setBomRows([]);
      }
    } catch (err: any) {
      console.error('Error loading BoM data:', err);
      setErrorMsg('Gagal memuat data takaran bahan.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRow = () => {
    const firstAvailable = availableIngredients[0]?.id || '';
    setBomRows((prev) => [
      ...prev,
      {
        inventoryItemId: firstAvailable,
        quantityPerUnit: 25,
        consumptionBasis: 'PER_UNIT',
        notes: '',
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    setBomRows((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpdateRow = (index: number, field: keyof BomRow, value: any) => {
    setBomRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Map inventory items by id for quick lookup
  const ingredientsMap = useMemo(() => {
    const map = new Map<string, RecipeInventoryItem>();
    availableIngredients.forEach((it) => map.set(it.id, it));
    return map;
  }, [availableIngredients]);

  // Kalkulasi Finansial BoM real-time
  const totalBomCost = useMemo(() => {
    return bomRows.reduce((acc, row) => {
      const item = ingredientsMap.get(row.inventoryItemId);
      const avgCost = Number(item?.averageCost || 0);
      const qty = Number(row.quantityPerUnit || 0);
      return acc + Math.round(avgCost * qty);
    }, 0);
  }, [bomRows, ingredientsMap]);

  const servicePrice = Number(service?.price || 0);
  const grossMargin = Math.max(0, servicePrice - totalBomCost);
  const marginPercent = servicePrice > 0 ? Math.round((grossMargin / servicePrice) * 100) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!service) return;

    // Validasi baris
    for (let i = 0; i < bomRows.length; i++) {
      const row = bomRows[i];
      if (!row.inventoryItemId) {
        setErrorMsg(`Pilih bahan baku pada baris #${i + 1}`);
        return;
      }
      if (Number(row.quantityPerUnit) <= 0) {
        setErrorMsg(`Takaran pada baris #${i + 1} harus lebih besar dari 0`);
        return;
      }
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await api.saveLaundryServiceBom(service.id, {
        bomItems: bomRows.map((r) => ({
          inventoryItemId: r.inventoryItemId,
          quantityPerUnit: Number(r.quantityPerUnit),
          consumptionBasis: r.consumptionBasis,
          notes: r.notes?.trim() || undefined,
        })),
      });

      if (res.status === 'success') {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message || 'Gagal menyimpan konfigurasi takaran bahan');
      }
    } catch (err: any) {
      console.error('Error saving BoM:', err);
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !service) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        {/* Header - Sticky */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-900 flex items-center justify-center shadow-xs shrink-0">
              <FlaskConical className="w-5 h-5 shrink-0" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900 truncate">
                  Takaran Bahan Cuci (BoM): {service.name}
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 uppercase">
                  {service.unit}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate">
                Atur pemakaian deterjen, softener, dan parfum yang otomatis dipotong saat masuk mesin cuci.
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

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Kartu Ringkasan Finansial & HPP BoM */}
            <div className="p-4 bg-gradient-to-br from-slate-900 to-blue-950 rounded-2xl text-white shadow-md">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    Tarif Layanan
                  </span>
                  <span className="text-base font-black text-white">
                    Rp {servicePrice.toLocaleString('id-ID')}
                    <span className="text-xs font-normal text-slate-400"> / {service.unit}</span>
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-300 tracking-wider block">
                    Total HPP Bahan
                  </span>
                  <span className="text-base font-black text-amber-400">
                    Rp {totalBomCost.toLocaleString('id-ID')}
                    <span className="text-xs font-normal text-amber-200/70"> / {service.unit}</span>
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider block">
                    Estimasi Laba Kotor
                  </span>
                  <span className="text-base font-black text-emerald-400">
                    Rp {grossMargin.toLocaleString('id-ID')}
                  </span>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-300 tracking-wider block">
                    Margin Kotor
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-base font-black text-blue-200">{marginPercent}%</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        marginPercent >= 70
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : marginPercent >= 40
                          ? 'bg-blue-500/20 text-blue-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {marginPercent >= 70 ? 'Sangat Sehat' : marginPercent >= 40 ? 'Moderat' : 'Tipis'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Petunjuk Operasional Otomatis */}
            <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 text-xs text-blue-900 flex items-start gap-2.5">
              <Info className="w-4 h-4 text-blue-800 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                <b>Otomatisasi Potong Stok:</b> Saat cucian beralih ke tahap <b>WASHING / CUCI</b> pada alur produksi (Kanban/Stage Tracker), sistem otomatis mengurangi saldo stok di gudang dan mencatat kartu stok <i>PRODUCTION_CONSUMPTION</i>.
              </p>
            </div>

            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-blue-900" />
                <span className="text-xs font-semibold">Memuat resep takaran bahan...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-800">
                    Komposisi Bahan Cuci ({bomRows.length} item terdaftar)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="px-3 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Bahan</span>
                  </button>
                </div>

                {bomRows.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                    <FlaskConical className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-600">Belum Ada Takaran Bahan</p>
                    <p className="text-[11px] text-slate-400 mt-0.5 max-w-sm mx-auto">
                      Tambahkan deterjen cair, bubuk, softener, atau parfum agar HPP terhitung otomatis dan stok gudang terpotong akurat.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="mt-3 px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Tambah Bahan Sekarang</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {bomRows.map((row, idx) => {
                      const selectedIng = ingredientsMap.get(row.inventoryItemId);
                      const baseUom = selectedIng?.canonicalUom || 'ML';
                      const avgCost = Number(selectedIng?.averageCost || 0);
                      const lineCost = Math.round(avgCost * Number(row.quantityPerUnit || 0));

                      return (
                        <div
                          key={idx}
                          className="p-3.5 bg-slate-50/90 hover:bg-slate-50 rounded-2xl border border-slate-200/90 transition-all space-y-2.5"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
                            {/* 1. Pilihan Bahan Baku */}
                            <div className="sm:col-span-5">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Bahan Cuci #{idx + 1}
                              </label>
                              <div className="relative">
                                <select
                                  value={row.inventoryItemId}
                                  onChange={(e) => handleUpdateRow(idx, 'inventoryItemId', e.target.value)}
                                  className="w-full h-10 pl-3 pr-10 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 appearance-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 cursor-pointer"
                                >
                                  {availableIngredients.map((it) => (
                                    <option key={it.id} value={it.id}>
                                      {it.name} (HPP: Rp {Number(it.averageCost || 0).toLocaleString('id-ID')}/{it.canonicalUom})
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                              </div>
                              {selectedIng?.purchaseConversionFactor && Number(selectedIng.purchaseConversionFactor) > 1 && (
                                <span className="text-[10px] text-blue-700 font-semibold mt-0.5 block">
                                  Beli: 1 {selectedIng.purchaseUom || 'Satuan'} = {Number(selectedIng.purchaseConversionFactor).toLocaleString('id-ID')} {selectedIng.canonicalUom}
                                </span>
                              )}
                            </div>

                            {/* 2. Takaran Pemakaian */}
                            <div className="sm:col-span-3">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Takaran ({baseUom})
                              </label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="any"
                                  min="0.001"
                                  value={row.quantityPerUnit}
                                  onChange={(e) => handleUpdateRow(idx, 'quantityPerUnit', Number(e.target.value))}
                                  className="w-full h-10 pl-3 pr-12 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 pointer-events-none">
                                  {baseUom}
                                </span>
                              </div>
                            </div>

                            {/* 3. Basis Konsumsi */}
                            <div className="sm:col-span-3">
                              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                                Basis Konsumsi
                              </label>
                              <div className="relative">
                                <select
                                  value={row.consumptionBasis}
                                  onChange={(e) => handleUpdateRow(idx, 'consumptionBasis', e.target.value)}
                                  className="w-full h-10 pl-2.5 pr-10 bg-white border border-slate-300 rounded-xl text-[11px] font-bold text-slate-900 appearance-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 cursor-pointer"
                                >
                                  <option value="PER_UNIT">Per {service.unit} (Proporsional)</option>
                                  <option value="PER_ORDER">Per Nota (Flat 1x)</option>
                                </select>
                                <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                              </div>
                            </div>

                            {/* 4. Tombol Hapus */}
                            <div className="sm:col-span-1 flex items-center justify-end sm:pt-6">
                              <button
                                type="button"
                                onClick={() => handleRemoveRow(idx)}
                                className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
                                title="Hapus bahan dari takaran"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Baris Keterangan Biaya Baris */}
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60 text-slate-500">
                            <span className="italic">
                              Biaya bahan: {row.quantityPerUnit} {baseUom} &times; Rp {avgCost.toLocaleString('id-ID')}
                            </span>
                            <span className="font-mono font-bold text-slate-900">
                              = Rp {lineCost.toLocaleString('id-ID')} {row.consumptionBasis === 'PER_ORDER' ? '(Flat)' : `/${service.unit}`}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sticky Action Footer Sesuai Pantangan #10 */}
          <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <Sparkles className="w-4 h-4 text-blue-900" />
              <span>
                Total BoM: <b>Rp {totalBomCost.toLocaleString('id-ID')}</b> | Laba: <b>Rp {grossMargin.toLocaleString('id-ID')}</b> ({marginPercent}%)
              </span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting || loading}
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
                    <span>Simpan Takaran BoM</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
