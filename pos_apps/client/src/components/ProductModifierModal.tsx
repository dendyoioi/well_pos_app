import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, ShoppingCart } from 'lucide-react';
import type { Product, ProductModifierGroup, ProductModifierOption } from '../types/product';

interface ProductModifierModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onConfirm: (payload: {
    product: Product;
    selectedOptions: { groupName: string; option: ProductModifierOption }[];
    note: string;
    finalPrice: number;
  }) => void;
}

export const ProductModifierModal: React.FC<ProductModifierModalProps> = ({
  isOpen,
  onClose,
  product,
  onConfirm,
}) => {
  // Mapping of groupId -> optionId (for SINGLE) or optionId[] (for MULTIPLE)
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!product || !product.modifiers) {
      setSelections({});
      setNote('');
      setValidationError(null);
      return;
    }

    // Pre-select defaults
    const initial: Record<string, string[]> = {};
    product.modifiers.forEach((g) => {
      const defaultOpt = g.options.find((o) => o.isDefault) || (g.required ? g.options[0] : null);
      if (defaultOpt) {
        initial[g.id] = [defaultOpt.id];
      } else {
        initial[g.id] = [];
      }
    });

    setSelections(initial);
    setNote('');
    setValidationError(null);
  }, [product, isOpen]);

  if (!isOpen || !product || !product.modifiers || product.modifiers.length === 0) return null;

  const handleSelectOption = (group: ProductModifierGroup, optId: string) => {
    setValidationError(null);
    setSelections((prev) => {
      if (group.type === 'SINGLE') {
        return { ...prev, [group.id]: [optId] };
      } else {
        const current = prev[group.id] || [];
        if (current.includes(optId)) {
          return { ...prev, [group.id]: current.filter((id) => id !== optId) };
        } else {
          return { ...prev, [group.id]: [...current, optId] };
        }
      }
    });
  };

  // Calculate extra price
  let totalDelta = 0;
  const flatSelectedOptions: { groupName: string; option: ProductModifierOption }[] = [];

  product.modifiers.forEach((g) => {
    const selectedIds = selections[g.id] || [];
    selectedIds.forEach((optId) => {
      const opt = g.options.find((o) => o.id === optId);
      if (opt) {
        totalDelta += opt.priceDelta || 0;
        flatSelectedOptions.push({
          groupName: g.name,
          option: opt,
        });
      }
    });
  });

  const basePrice = product.price || product.basePrice || 0;
  const finalPrice = basePrice + totalDelta;

  const handleConfirm = () => {
    // Validate required groups
    for (const g of product.modifiers!) {
      if (g.required) {
        const picked = selections[g.id] || [];
        if (picked.length === 0) {
          setValidationError(`Pilihan "${g.name}" wajib ditentukan!`);
          return;
        }
      }
    }

    onConfirm({
      product,
      selectedOptions: flatSelectedOptions,
      note: note.trim(),
      finalPrice,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        {/* Header Modal */}
        <div className="p-3.5 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-12 h-12 rounded-xl object-cover border border-slate-200 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold text-sm shrink-0">
                {product.name.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-extrabold text-blue-950 text-base leading-snug truncate">
                {product.name}
              </h3>
              <div className="text-xs text-slate-500 flex items-center gap-2 truncate">
                <span className="truncate">Harga Dasar: Rp {basePrice.toLocaleString('id-ID')}</span>
                <span className="text-slate-300 shrink-0">•</span>
                <span className="text-blue-900 font-semibold truncate">{product.category.name}</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 sm:space-y-5 flex-1 overscroll-contain text-slate-800">
          {validationError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 font-bold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {/* Modifier Groups */}
          {product.modifiers.map((group) => {
            const currentSelected = selections[group.id] || [];

            return (
              <div key={group.id} className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <span>{group.name}</span>
                    {group.required ? (
                      <span className="text-[10px] text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded">
                        Wajib
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-normal">Opsional</span>
                    )}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {group.type === 'SINGLE' ? 'Pilih 1' : 'Boleh lebih dari 1'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {group.options.map((opt) => {
                    const isPicked = currentSelected.includes(opt.id);

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectOption(group, opt.id)}
                        className={`p-3 rounded-xl border text-left flex items-center justify-between transition-all active:scale-[0.98] ${
                          isPicked
                            ? 'bg-blue-900/5 border-blue-900 text-blue-950 font-bold ring-1 ring-blue-900/30'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`w-4 h-4 rounded-${
                              group.type === 'SINGLE' ? 'full' : 'md'
                            } border flex items-center justify-center transition-colors ${
                              isPicked
                                ? 'bg-blue-900 border-blue-900 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isPicked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span className="text-xs">{opt.name}</span>
                        </div>
                        {opt.priceDelta > 0 && (
                          <span className="text-[11px] font-bold text-emerald-600">
                            +Rp {opt.priceDelta.toLocaleString('id-ID')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Catatan Khusus untuk Dapur/Barista */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            <label className="text-xs font-bold text-slate-700 block">
              Catatan Tambahan (Opsional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="misal: Sambal dipisah, minta sedotan ramah lingkungan..."
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-900 focus:bg-white text-slate-900 rounded-xl px-3.5 py-2 text-xs outline-none transition-all"
            />
          </div>
        </div>

        {/* Footer Modal: Ringkasan Harga & Tombol Tambah */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-white flex items-center justify-between gap-3 sm:gap-4 shrink-0 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
          <div>
            <div className="text-[11px] text-slate-500 font-medium">Total Harga Unit</div>
            <div className="text-base sm:text-lg font-black text-blue-950">
              Rp {finalPrice.toLocaleString('id-ID')}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-11 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors flex items-center justify-center cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="h-11 px-5 rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-900/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Masuk Keranjang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
