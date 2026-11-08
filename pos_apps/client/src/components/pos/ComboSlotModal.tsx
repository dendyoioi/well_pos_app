import React, { useState, useEffect } from 'react';
import { X, Check, AlertCircle, ShoppingCart, Sparkles, CheckCircle2 } from 'lucide-react';
import type { Product, BundleChildItem, BundleSlotGroup } from '../../types/product';

export interface ComboSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onConfirm: (payload: {
    product: Product;
    selectedItems: { slotName: string; item: BundleChildItem }[];
    selectedBundleItemIds: string[];
    finalPrice: number;
    note?: string;
  }) => void;
}

export const ComboSlotModal: React.FC<ComboSlotModalProps> = ({
  isOpen,
  onClose,
  product,
  onConfirm,
}) => {
  // Mapping of slotName -> selected bundleItemId
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const bundleSlots: BundleSlotGroup[] = product?.bundleSlots || [];
  const fixedItems: BundleChildItem[] = (product?.bundleItems || []).filter(
    (bi) => !bi.slotName || bi.slotName.trim() === ''
  );

  useEffect(() => {
    if (!product || !product.bundleSlots || product.bundleSlots.length === 0) {
      setSelections({});
      setNote('');
      setValidationError(null);
      return;
    }

    // Pre-select default options for each slot
    const initial: Record<string, string> = {};
    product.bundleSlots.forEach((slotGroup) => {
      // Prioritaskan item yang bertanda isDefault dan tidak out-of-stock
      const defaultOpt = slotGroup.items.find((it) => it.isDefault && !it.isOutOfStock)
        || slotGroup.items.find((it) => !it.isOutOfStock)
        || slotGroup.items[0];

      if (defaultOpt && defaultOpt.id) {
        initial[slotGroup.slotName] = defaultOpt.id;
      }
    });

    setSelections(initial);
    setNote('');
    setValidationError(null);
  }, [product, isOpen]);

  if (!isOpen || !product) return null;

  const handleSelectSlotOption = (slotName: string, itemId: string, isOutOfStock?: boolean) => {
    if (isOutOfStock) return;
    setValidationError(null);
    setSelections((prev) => ({
      ...prev,
      [slotName]: itemId,
    }));
  };

  // Kalkulasi ekstra biaya dari opsi slot yang dipilih
  let totalDelta = 0;
  const flatSelectedItems: { slotName: string; item: BundleChildItem }[] = [];
  const selectedBundleItemIds: string[] = [];

  bundleSlots.forEach((slotGroup) => {
    const selectedId = selections[slotGroup.slotName];
    if (selectedId) {
      const item = slotGroup.items.find((it) => it.id === selectedId);
      if (item) {
        totalDelta += Number(item.priceAdjustment || 0);
        flatSelectedItems.push({
          slotName: slotGroup.slotName,
          item,
        });
        selectedBundleItemIds.push(item.id!);
      }
    }
  });

  const basePrice = Number(product.price || product.basePrice || 0);
  const finalPrice = basePrice + totalDelta;

  const handleConfirm = () => {
    // Validasi: pastikan setiap slot telah dipilih opsi aktifnya
    for (const slotGroup of bundleSlots) {
      const pickedId = selections[slotGroup.slotName];
      if (!pickedId) {
        setValidationError(`Pilihan untuk slot "${slotGroup.slotName}" wajib ditentukan!`);
        return;
      }
      const pickedItem = slotGroup.items.find((it) => it.id === pickedId);
      if (pickedItem?.isOutOfStock) {
        setValidationError(`Opsi "${pickedItem.childProductName}" pada slot "${slotGroup.slotName}" sedang habis stok! Silakan pilih opsi lain.`);
        return;
      }
    }

    onConfirm({
      product,
      selectedItems: flatSelectedItems,
      selectedBundleItemIds,
      finalPrice,
      note: note.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        {/* Header Modal */}
        <div className="p-3.5 sm:p-5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-xs shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-blue-900 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
                <Sparkles className="w-6 h-6 text-amber-300" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs">
                  Paket Kombo ({bundleSlots.length} Pilihan)
                </span>
                <span className="text-[11px] text-slate-500 font-semibold">{product.category?.name || 'Katalog'}</span>
              </div>
              <h3 className="font-extrabold text-blue-950 text-base leading-snug truncate mt-0.5">
                {product.name}
              </h3>
              <p className="text-xs text-slate-500">
                Harga Dasar: <strong className="font-mono text-slate-800 font-bold">Rp {basePrice.toLocaleString('id-ID')}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors cursor-pointer"
            title="Tutup dialog"
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

          {/* Komponen Tetap (Pasti Dapat) jika ada */}
          {fixedItems.length > 0 && (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                📦 Sudah Termasuk di Dalam Paket:
              </span>
              <div className="flex flex-wrap gap-2">
                {fixedItems.map((fi, idx) => (
                  <span
                    key={fi.id || idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{fi.childProductName} ({fi.quantity}x)</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Slot Pilihan Dinamis */}
          {bundleSlots.map((slotGroup, sIdx) => {
            const currentSelectedId = selections[slotGroup.slotName];

            return (
              <div key={slotGroup.slotName} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-blue-900 text-white text-[10px] flex items-center justify-center font-bold">
                      {sIdx + 1}
                    </span>
                    <span>{slotGroup.slotName}</span>
                    <span className="text-[10px] text-blue-900 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                      Pilih 1
                    </span>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {slotGroup.items.map((opt) => {
                    const isPicked = currentSelectedId === opt.id;
                    const isOut = Boolean(opt.isOutOfStock);
                    const extraPrice = Number(opt.priceAdjustment || 0);

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={isOut}
                        onClick={() => handleSelectSlotOption(slotGroup.slotName, opt.id!, isOut)}
                        className={`p-3 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer select-none ${
                          isOut
                            ? 'opacity-40 bg-slate-50 border-slate-200 cursor-not-allowed'
                            : isPicked
                            ? 'bg-blue-50/80 border-blue-600 text-blue-950 font-bold ring-2 ring-blue-500/20 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0 ${
                              isPicked
                                ? 'bg-blue-600 border-blue-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isPicked && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs truncate">{opt.childProductName}</p>
                            {isOut ? (
                              <span className="text-[10px] text-rose-600 font-bold">Stok Habis</span>
                            ) : opt.isDefault ? (
                              <span className="text-[10px] text-slate-400">Pilihan Standar</span>
                            ) : null}
                          </div>
                        </div>

                        <div className="shrink-0 text-right ml-2 font-mono">
                          {extraPrice > 0 ? (
                            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              +Rp {extraPrice.toLocaleString('id-ID')}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-semibold">Gratis</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Catatan Khusus Opsi */}
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <label className="text-xs font-bold text-slate-700 block">
              Catatan Pesanan (Opsional):
            </label>
            <input
              type="text"
              placeholder="Contoh: Es dipisah, jangan terlalu manis..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-500 focus:outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Sticky Action Footer (Safe-Area Inset) */}
        <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Total Harga Paket
            </span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-black text-blue-950 font-mono">
                Rp {finalPrice.toLocaleString('id-ID')}
              </span>
              {totalDelta > 0 && (
                <span className="text-[11px] font-bold text-amber-700 font-mono">
                  (+Rp {totalDelta.toLocaleString('id-ID')})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-950 text-white text-xs font-black shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>+ Tambah ke Keranjang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
