import React, { useState } from 'react';
import { X, Package, AlertCircle, Save, Loader2, ChevronDown } from 'lucide-react';
import { api } from '../../services/api';
import { CurrencyInput } from '../ui/CurrencyInput';

interface CreateIngredientModalProps {
  isOpen: boolean;
  onClose: () => void;
  outletId?: string;
  onSuccess: () => void;
}

export const CreateIngredientModal: React.FC<CreateIngredientModalProps> = ({
  isOpen,
  onClose,
  outletId,
  onSuccess,
}) => {
  const [name, setName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [canonicalUom, setCanonicalUom] = useState('GRAM');
  const [averageCost, setAverageCost] = useState<number>(0);
  const [initialStock, setInitialStock] = useState<number>(0);
  const [reorderPoint, setReorderPoint] = useState<number>(100);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Nama bahan baku wajib diisi');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await api.createInventoryItem({
        name: name.trim(),
        itemCode: itemCode.trim() || undefined,
        canonicalUom,
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
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in duration-200 flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        {/* Header - Sticky */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-900 flex items-center justify-center shadow-xs shrink-0">
              <Package className="w-5 h-5 shrink-0" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-extrabold text-slate-900 truncate">Tambah Bahan Baku Baru</h2>
              <p className="text-xs text-slate-500 font-medium truncate">Daftarkan bahan mentah racikan resep &amp; stok dapur</p>
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

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Nama Bahan Baku <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Bubuk Cokelat Dark Premium, Sirup Hazelnut..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Kode Bahan (Opsional)
              </label>
              <input
                type="text"
                value={itemCode}
                onChange={(e) => setItemCode(e.target.value)}
                placeholder="Auto jika kosong (RAW-001)"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Satuan Ukur Standar (UOM) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={canonicalUom}
                  onChange={(e) => setCanonicalUom(e.target.value)}
                  className="w-full h-11 sm:h-10 pl-3.5 pr-9 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all appearance-none cursor-pointer"
                >
                  <option value="GRAM">GRAM (Berat Bubuk, Biji, Daging)</option>
                  <option value="ML">ML (Cairan, Susu, Sirup, Saus)</option>
                  <option value="PCS">PCS (Cup, Sedotan, Telur, Roti)</option>
                  <option value="KG">KG (Kilogram)</option>
                  <option value="LITER">LITER</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Estimasi HPP per {canonicalUom}
              </label>
              <CurrencyInput
                value={averageCost}
                onChange={(val) => setAverageCost(val)}
                placeholder="0"
                className="w-full"
              />
              <p className="text-[11px] text-slate-400 mt-1">Biaya modal satuan untuk resep</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Peringatan Stok Minimum ({canonicalUom})
              </label>
              <input
                type="number"
                min="0"
                value={reorderPoint}
                onChange={(e) => setReorderPoint(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
              />
              <p className="text-[11px] text-slate-400 mt-1">Batas alert saat stok mulai menipis</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Saldo Stok Awal di Outlet Toko ({canonicalUom})
            </label>
            <input
              type="number"
              min="0"
              value={initialStock}
              onChange={(e) => setInitialStock(Number(e.target.value))}
              placeholder="0 jika belum ada fisik di gudang/dapur"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
            />
            <p className="text-[11px] text-slate-400 mt-1">Stok fisik yang sudah tersedia saat ini</p>
          </div>

          </div>

          {/* Action Buttons - Sticky Bottom with Safe Area */}
          <div className="p-4 sm:px-6 bg-slate-50/80 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
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
                  <span>Simpan Bahan Baku</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
