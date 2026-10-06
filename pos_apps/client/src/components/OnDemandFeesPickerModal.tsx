import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  ShoppingBag,
  Box,
  Plus,
  Minus,
  RotateCcw,
  RefreshCw,
  Check,
  Sparkles,
  Settings,
} from 'lucide-react';
import type { OutletFee } from '../types/outlet';

interface OnDemandFeesPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDemandFees: OutletFee[];
  currentQuantities: Record<string, number>;
  onConfirm: (quantities: Record<string, number>) => void;
  onOpenManageFees?: () => void;
  onRefresh?: () => Promise<void> | void;
  isRefreshing?: boolean;
}

export const OnDemandFeesPickerModal: React.FC<OnDemandFeesPickerModalProps> = ({
  isOpen,
  onClose,
  onDemandFees,
  currentQuantities,
  onConfirm,
  onOpenManageFees,
  onRefresh,
  isRefreshing = false,
}) => {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      setQuantities({ ...currentQuantities });
      setSearchQuery('');
      onRefresh?.();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleIncrement = (feeId: string) => {
    setQuantities((prev) => ({
      ...prev,
      [feeId]: (prev[feeId] || 0) + 1,
    }));
  };

  const handleDecrement = (feeId: string) => {
    setQuantities((prev) => {
      const current = prev[feeId] || 0;
      if (current <= 1) {
        const copy = { ...prev };
        delete copy[feeId];
        return copy;
      }
      return {
        ...prev,
        [feeId]: current - 1,
      };
    });
  };

  const handleSetDirect = (feeId: string, val: number) => {
    const safeVal = Math.max(0, val);
    setQuantities((prev) => {
      if (safeVal === 0) {
        const copy = { ...prev };
        delete copy[feeId];
        return copy;
      }
      return { ...prev, [feeId]: safeVal };
    });
  };

  const handleReset = () => {
    setQuantities({});
  };

  const handleSave = () => {
    onConfirm(quantities);
    onClose();
  };

  const activeFees = onDemandFees.filter((f) => f.isActive);
  const filteredFees = activeFees.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  // Total calculation
  const totalItemCount = Object.values(quantities).reduce((sum, q) => sum + (q || 0), 0);
  const totalAmount = Object.entries(quantities).reduce((sum, [feeId, qty]) => {
    const fee = onDemandFees.find((f) => f.id === feeId);
    return sum + (fee ? fee.rate * qty : 0);
  }, 0);

  const getFeeIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('box') || lower.includes('kotak') || lower.includes('dus')) {
      return <Box className="w-5 h-5 text-amber-600" />;
    }
    return <ShoppingBag className="w-5 h-5 text-blue-600" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] sm:max-h-[85vh]">
        {/* Modal Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-blue-950 to-indigo-950 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-800/80 border border-blue-700/60 flex items-center justify-center text-blue-200 shadow-xs">
              <ShoppingBag className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                  Pilih Kemasan & Biaya Tambahan
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300">
                  On-Demand
                </span>
              </div>
              <p className="text-xs text-blue-200/90 font-medium">
                Daftar semua kemasan, plastik, box, dan perlengkapan pesanan
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

        {/* Search Bar & Quick Actions */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2 shrink-0">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kemasan / kantong / box..."
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 focus:border-blue-900 rounded-xl text-xs sm:text-sm font-medium outline-none transition-all"
            />
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={() => onRefresh()}
              disabled={isRefreshing}
              title="Sinkronkan daftar kemasan terbaru dari server"
              className="p-2 bg-white border border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center transition-all shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-900 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          )}

          {onOpenManageFees && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenManageFees();
              }}
              title="Kelola Daftar Kemasan (Supervisor / Owner)"
              className="px-3 py-2 bg-white border border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-slate-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Settings className="w-3.5 h-3.5 text-blue-900" />
              <span className="hidden sm:inline">Kelola</span>
            </button>
          )}
        </div>

        {/* Fees List */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-2.5">
          {filteredFees.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              <ShoppingBag className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-bold text-slate-600">
                {searchQuery ? 'Tidak ada kemasan yang sesuai pencarian' : 'Belum ada biaya on-demand yang aktif'}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                {searchQuery
                  ? 'Coba gunakan kata kunci pencarian yang lain.'
                  : 'Gunakan tombol kelola untuk mengaktifkan kemasan atau tombol sinkronisasi untuk memperbarui data kasir.'}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                {onRefresh && (
                  <button
                    type="button"
                    onClick={() => onRefresh()}
                    disabled={isRefreshing}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                    <span>Sinkronkan Sekarang</span>
                  </button>
                )}
                {onOpenManageFees && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenManageFees();
                    }}
                    className="px-3 py-1.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>Kelola Kemasan</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            filteredFees.map((fee) => {
              const qty = quantities[fee.id] || 0;
              const isSelected = qty > 0;

              return (
                <div
                  key={fee.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'bg-blue-50/70 border-blue-900/40 shadow-xs ring-1 ring-blue-900/20'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-blue-100 text-blue-900' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {getFeeIcon(fee.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-blue-950 truncate">
                          {fee.name}
                        </span>
                        {fee.isQuickAccess && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                            <span>Cepat</span>
                          </span>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-slate-500 mt-0.5">
                        Rp {fee.rate.toLocaleString('id-ID')} / pcs
                      </div>
                    </div>
                  </div>

                  {/* Quantity Counter */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 shadow-xs shrink-0">
                    <button
                      type="button"
                      disabled={qty === 0}
                      onClick={() => handleDecrement(fee.id)}
                      className="w-7 h-7 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center active:scale-95 transition-all"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>

                    <input
                      type="number"
                      min={0}
                      value={qty}
                      onChange={(e) => handleSetDirect(fee.id, Number(e.target.value))}
                      className="w-10 text-center text-xs sm:text-sm font-black text-blue-950 outline-none bg-transparent"
                    />

                    <button
                      type="button"
                      onClick={() => handleIncrement(fee.id)}
                      className="w-7 h-7 rounded-lg bg-blue-900 hover:bg-blue-800 text-white flex items-center justify-center active:scale-95 transition-all shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={totalItemCount === 0}
              onClick={handleReset}
              className="text-xs font-bold text-slate-500 hover:text-rose-600 disabled:opacity-30 flex items-center gap-1 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset (0)</span>
            </button>

            {totalItemCount > 0 && (
              <div className="text-xs text-slate-700">
                <span className="font-bold text-blue-950">{totalItemCount} item</span> (Rp{' '}
                {totalAmount.toLocaleString('id-ID')})
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs sm:text-sm font-extrabold flex items-center gap-1.5 shadow-md shadow-blue-900/20 active:scale-98 transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Terapkan ke Keranjang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
