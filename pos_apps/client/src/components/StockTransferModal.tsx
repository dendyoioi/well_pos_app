import React, { useState, useEffect } from 'react';
import {
  ArrowLeftRight,
  Store,
  Package,
  AlertCircle,
  CheckCircle2,
  X,
  FileText,
  Warehouse,
} from 'lucide-react';
import type { Product } from '../types/product';
import type { Outlet } from '../types/outlet';
import { api } from '../services/api';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  activeOutlet?: Outlet | null;
  defaultSourceOutletId?: string;
  products: Product[];
}

export const StockTransferModal: React.FC<StockTransferModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  activeOutlet,
  defaultSourceOutletId,
  products,
}) => {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [sourceOutletId, setSourceOutletId] = useState<string>('');
  const [targetOutletId, setTargetOutletId] = useState<string>('');
  const [sourceProducts, setSourceProducts] = useState<Product[]>(products);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [loadingOutlets, setLoadingOutlets] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchAllOutlets = async () => {
      setLoadingOutlets(true);
      try {
        const res = await api.getOutlets();
        if (res.status === 'success' && res.data) {
          setOutlets(res.data);
          const initialSource = defaultSourceOutletId || activeOutlet?.id || res.data[0]?.id || '';
          setSourceOutletId(initialSource);

          // Default target to first outlet that is not source
          const otherOutlet = res.data.find((o: Outlet) => o.id !== initialSource);
          setTargetOutletId(otherOutlet?.id || '');
        }
      } catch (err) {
        console.error('Gagal mengambil daftar cabang:', err);
      } finally {
        setLoadingOutlets(false);
      }
    };

    fetchAllOutlets();
  }, [isOpen, activeOutlet?.id, defaultSourceOutletId]);

  // Sinkronisasi otomatis agar targetOutletId tidak pernah sama dengan sourceOutletId
  useEffect(() => {
    if (!sourceOutletId || outlets.length === 0) return;
    if (targetOutletId === sourceOutletId || !outlets.some((o) => o.id === targetOutletId)) {
      const validTarget = outlets.find((o) => o.id !== sourceOutletId);
      if (validTarget) {
        setTargetOutletId(validTarget.id);
      }
    }
  }, [sourceOutletId, targetOutletId, outlets]);

  const handleSourceChange = (newSourceId: string) => {
    setSourceOutletId(newSourceId);
    if (targetOutletId === newSourceId) {
      const nextTarget = outlets.find((o) => o.id !== newSourceId);
      if (nextTarget) {
        setTargetOutletId(nextTarget.id);
      }
    }
  };

  const handleTargetChange = (newTargetId: string) => {
    setTargetOutletId(newTargetId);
    if (sourceOutletId === newTargetId) {
      const nextSource = outlets.find((o) => o.id !== newTargetId);
      if (nextSource) {
        setSourceOutletId(nextSource.id);
      }
    }
  };

  const handleSwapOutlets = () => {
    if (!sourceOutletId || !targetOutletId) return;
    const oldSource = sourceOutletId;
    const oldTarget = targetOutletId;
    setSourceOutletId(oldTarget);
    setTargetOutletId(oldSource);
  };

  // Update daftar produk & stok riil berdasarkan cabang asal yang dipilih
  useEffect(() => {
    if (!isOpen || !sourceOutletId) return;

    if (sourceOutletId === activeOutlet?.id && products.length > 0) {
      setSourceProducts(products);
      if (!selectedProductId || !products.some((p) => p.id === selectedProductId)) {
        setSelectedProductId(products[0]?.id || '');
      }
      return;
    }

    api.getProducts({ outletId: sourceOutletId })
      .then((res) => {
        if (res.status === 'success' && res.data) {
          setSourceProducts(res.data);
          if (!selectedProductId || !res.data.some((p: Product) => p.id === selectedProductId)) {
            setSelectedProductId(res.data[0]?.id || '');
          }
        }
      })
      .catch((err) => console.error('Gagal mengambil produk cabang asal:', err));
  }, [sourceOutletId, isOpen, activeOutlet?.id, products]);

  if (!isOpen) return null;

  const sourceOutlet = outlets.find((o) => o.id === sourceOutletId);
  const targetOutlet = outlets.find((o) => o.id === targetOutletId);
  const selectedProduct = sourceProducts.find((p) => p.id === selectedProductId);
  const availableStock = selectedProduct?.stock || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sourceOutletId || !targetOutletId) {
      setError('Cabang asal dan cabang tujuan wajib dipilih');
      return;
    }

    if (sourceOutletId === targetOutletId) {
      setError('Cabang asal dan cabang tujuan tidak boleh sama');
      return;
    }

    if (!selectedProductId) {
      setError('Silakan pilih produk yang akan ditransfer');
      return;
    }

    if (quantity <= 0) {
      setError('Jumlah transfer harus lebih dari 0');
      return;
    }

    if (quantity > availableStock) {
      setError(`Stok di cabang asal tidak mencukupi (Tersedia: ${availableStock} ${selectedProduct?.unit || 'Pcs'})`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.transferStock({
        sourceOutletId,
        targetOutletId,
        productId: selectedProductId,
        quantity,
        notes: notes.trim() || undefined,
      });

      if (res.status === 'success') {
        onSuccess();
        onClose();
      } else {
        setError(res.message || 'Gagal memproses transfer stok');
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem saat transfer stok');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/20">
              <ArrowLeftRight className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-extrabold text-blue-950 text-base">Transfer Stok Antar Cabang</h3>
              <p className="text-xs text-slate-500 font-medium">Mutasi pemindahan barang antar cabang retail</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Cabang Asal & Cabang Tujuan */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">Rute Distribusi Stok</span>
              {outlets.length > 1 && (
                <button
                  type="button"
                  onClick={handleSwapOutlets}
                  disabled={submitting}
                  className="text-[11px] font-bold text-blue-900 hover:text-blue-950 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded-lg transition-all flex items-center gap-1 active:scale-95"
                  title="Balik Arah: Tukar Asal dan Tujuan"
                >
                  <ArrowLeftRight className="w-3 h-3" />
                  <span>Tukar Arah Rute</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    {sourceOutlet?.isWarehouse ? (
                      <Warehouse className="w-3.5 h-3.5 text-indigo-700" />
                    ) : (
                      <Store className="w-3.5 h-3.5 text-blue-900" />
                    )}
                    <span>Dari Lokasi (Asal)</span>
                  </label>
                  {sourceOutlet?.isWarehouse ? (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Gudang Pusat
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200">
                      Toko Cabang
                    </span>
                  )}
                </div>
                <select
                  value={sourceOutletId}
                  onChange={(e) => handleSourceChange(e.target.value)}
                  disabled={loadingOutlets || submitting}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.isWarehouse ? '🏭 [Gudang Pusat]' : '🏪 [Cabang]'} {o.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    {targetOutlet?.isWarehouse ? (
                      <Warehouse className="w-3.5 h-3.5 text-indigo-700" />
                    ) : (
                      <Store className="w-3.5 h-3.5 text-emerald-600" />
                    )}
                    <span>Ke Lokasi (Tujuan)</span>
                  </label>
                  {targetOutlet?.isWarehouse ? (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Gudang Pusat
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Toko Cabang
                    </span>
                  )}
                </div>
                <select
                  value={targetOutletId}
                  onChange={(e) => handleTargetChange(e.target.value)}
                  disabled={loadingOutlets || submitting}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-blue-950 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {outlets
                    .filter((o) => o.id !== sourceOutletId)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.isWarehouse ? '🏭 [Gudang Pusat]' : '🏪 [Cabang]'} {o.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          {/* Pemilihan Produk */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-blue-900" />
                <span>Pilih Barang / Produk</span>
              </span>
              {selectedProduct && (
                <span className="text-[11px] font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                  Stok Asal: {availableStock} {selectedProduct.unit}
                </span>
              )}
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {sourceProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.sku}] {p.name} - Sisa Stok: {p.stock} {p.unit}
                </option>
              ))}
            </select>
          </div>

          {/* Jumlah Qty Transfer */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Jumlah Transfer ({selectedProduct?.unit || 'Pcs'})
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max={availableStock}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                disabled={submitting}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-black text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setQuantity(availableStock)}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl whitespace-nowrap transition-colors"
              >
                Pindah Semua ({availableStock})
              </button>
            </div>
          </div>

          {/* Catatan Transfer */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Catatan / Nomor Dokumen Mutasi</span>
            </label>
            <input
              type="text"
              placeholder="Contoh: No. Surat Jalan SJ-004 / Bantuan stok akhir pekan"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={submitting}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800 placeholder-slate-400 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || availableStock <= 0}
              className="px-5 py-2.5 bg-blue-900 hover:bg-blue-950 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95 cursor-pointer"
            >
              {submitting ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Memproses Transfer...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Kirim Mutasi Stok</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
