import React, { useState } from 'react';
import {
  X,
  Split,
  Users,
  UtensilsCrossed,
  Check,
  ArrowRight,
} from 'lucide-react';
import type { CartItem } from '../../types/order';

export interface SplitBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartItem[];
  grandTotal: number;
  onProceedPayment: (amount: number, note?: string) => void;
}

export const SplitBillModal: React.FC<SplitBillModalProps> = ({
  isOpen,
  onClose,
  cart,
  grandTotal,
  onProceedPayment,
}) => {
  const [splitMode, setSplitMode] = useState<'EQUAL' | 'BY_ITEM'>('EQUAL');
  const [peopleCount, setPeopleCount] = useState<number>(2);
  const [selectedItemIndexes, setSelectedItemIndexes] = useState<number[]>([]);

  if (!isOpen) return null;

  // Mode Bagi Rata
  const perPersonAmount = Math.ceil(grandTotal / peopleCount);

  // Mode Pisah Item
  const selectedItemsSubtotal = selectedItemIndexes.reduce((acc, idx) => {
    const item = cart[idx];
    if (!item) return acc;
    const price = item.customPrice || item.product.price || item.product.basePrice || 0;
    return acc + price * item.quantity;
  }, 0);

  const toggleItemSelection = (idx: number) => {
    setSelectedItemIndexes((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  const handlePayEqual = (personIdx: number) => {
    onProceedPayment(
      perPersonAmount,
      `Split Bill Bagi Rata (${personIdx}/${peopleCount} Orang)`
    );
    onClose();
  };

  const handlePayByItem = () => {
    if (selectedItemsSubtotal <= 0) return;
    onProceedPayment(
      selectedItemsSubtotal,
      `Split Bill Pilihan (${selectedItemIndexes.length} Menu)`
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-xs">
              <Split className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Pecah Tagihan (Split Bill)</h3>
              <p className="text-[11px] text-slate-500">Pilih metode pembagian tagihan meja</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher: Bagi Rata vs Pisah Item */}
        <div className="p-3 bg-slate-100 border-b border-slate-200 flex gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSplitMode('EQUAL')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              splitMode === 'EQUAL'
                ? 'bg-white text-blue-950 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4 text-blue-900" />
            <span>Bagi Sama Rata</span>
          </button>

          <button
            type="button"
            onClick={() => setSplitMode('BY_ITEM')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              splitMode === 'BY_ITEM'
                ? 'bg-white text-blue-950 shadow-xs border border-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UtensilsCrossed className="w-4 h-4 text-emerald-600" />
            <span>Pilih per Menu / Item</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto overscroll-contain space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Total Tagihan Meja:</span>
            <span className="text-base font-black text-blue-900">
              Rp {grandTotal.toLocaleString('id-ID')}
            </span>
          </div>

          {splitMode === 'EQUAL' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Jumlah Orang / Bagian:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[2, 3, 4, 5].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPeopleCount(num)}
                      className={`py-2 rounded-xl text-xs font-black transition-all ${
                        peopleCount === num
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {num} Orang
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 text-center space-y-1">
                <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                  Nominal Pembayaran per Orang
                </span>
                <p className="text-2xl font-black text-blue-950">
                  Rp {perPersonAmount.toLocaleString('id-ID')}
                </p>
                <p className="text-[11px] text-slate-500">
                  ({peopleCount} orang × Rp {perPersonAmount.toLocaleString('id-ID')})
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700">Tender Pembayaran Bertahap:</span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {Array.from({ length: peopleCount }).map((_, i) => (
                    <div
                      key={i}
                      className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-900 font-bold text-xs flex items-center justify-center">
                          {i + 1}
                        </div>
                        <span className="text-xs font-bold text-slate-800">
                          Tamu #{i + 1}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePayEqual(i + 1)}
                        className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all shadow-2xs flex items-center gap-1 active:scale-95"
                      >
                        <span>Bayar (Rp {perPersonAmount.toLocaleString('id-ID')})</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-700">
                Pilih Menu yang Hendak Dibayarkan Sekarang:
              </span>
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1 divide-y divide-slate-100 bg-white border border-slate-200 rounded-xl p-1">
                {cart.map((item, idx) => {
                  const isSelected = selectedItemIndexes.includes(idx);
                  const price =
                    item.customPrice || item.product.price || item.product.basePrice || 0;
                  const itemSubtotal = price * item.quantity;

                  return (
                    <div
                      key={idx}
                      onClick={() => toggleItemSelection(idx)}
                      className={`p-2.5 rounded-lg flex items-center justify-between cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-blue-900 border-blue-900 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            {item.quantity}x {item.product.name}
                          </p>
                          {item.itemNote && (
                            <p className="text-[10px] text-slate-400">{item.itemNote}</p>
                          )}
                        </div>
                      </div>
                      <span className="text-xs font-black text-slate-900">
                        Rp {itemSubtotal.toLocaleString('id-ID')}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-900">Total Pilihan:</span>
                  <p className="text-xs text-emerald-700 font-medium">
                    {selectedItemIndexes.length} dari {cart.length} item dipilih
                  </p>
                </div>
                <span className="text-base font-black text-emerald-950">
                  Rp {selectedItemsSubtotal.toLocaleString('id-ID')}
                </span>
              </div>

              <button
                type="button"
                disabled={selectedItemsSubtotal <= 0}
                onClick={handlePayByItem}
                className={`w-full py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                  selectedItemsSubtotal > 0
                    ? 'bg-blue-900 hover:bg-blue-800 text-white active:scale-98'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <span>Bayar Bagian Ini (Rp {selectedItemsSubtotal.toLocaleString('id-ID')})</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <span className="text-[11px] text-slate-400">Pembayaran split bill tercatat pada struk</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-colors shadow-2xs cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
