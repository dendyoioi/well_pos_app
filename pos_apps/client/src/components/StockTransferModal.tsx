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
  Boxes,
} from 'lucide-react';
import type { Product } from '../types/product';
import type { Outlet } from '../types/outlet';
import type { RecipeInventoryItem } from '../types/recipe';
import { api } from '../services/api';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  activeOutlet?: Outlet | null;
  defaultSourceOutletId?: string;
  defaultItemType?: 'RAW' | 'PRODUCT';
  defaultInventoryItemId?: string;
  products: Product[];
}

export const StockTransferModal: React.FC<StockTransferModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  activeOutlet,
  defaultSourceOutletId,
  defaultItemType,
  defaultInventoryItemId,
  products,
}) => {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [sourceOutletId, setSourceOutletId] = useState<string>('');
  const [targetOutletId, setTargetOutletId] = useState<string>('');
  
  // Transfer Item Type: RAW (Bahan Baku / Resep BOM) atau PRODUCT (Produk Retail)
  const [itemType, setItemType] = useState<'RAW' | 'PRODUCT'>(defaultItemType || 'RAW');
  
  // Data list
  const [sourceProducts, setSourceProducts] = useState<Product[]>(products);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  
  const [sourceRawItems, setSourceRawItems] = useState<RecipeInventoryItem[]>([]);
  const [selectedRawItemId, setSelectedRawItemId] = useState<string>(defaultInventoryItemId || '');
  
  const [quantity, setQuantity] = useState<number>(1);
  const [notes, setNotes] = useState<string>('');
  const [loadingOutlets, setLoadingOutlets] = useState<boolean>(true);
  const [loadingItems, setLoadingItems] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Fetch seluruh outlet / gudang
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

          // Cek apakah lokasi asal adalah gudang
          const src = res.data.find((o: Outlet) => o.id === initialSource);
          if (src?.isWarehouse) {
            setItemType('RAW');
          } else if (defaultItemType) {
            setItemType(defaultItemType);
          }

          // Default target to first outlet that is not source
          const otherOutlet = res.data.find((o: Outlet) => o.id !== initialSource);
          setTargetOutletId(otherOutlet?.id || '');
        }
      } catch (err) {
        console.error('Gagal mengambil daftar outlet:', err);
      } finally {
        setLoadingOutlets(false);
      }
    };

    fetchAllOutlets();
  }, [isOpen, activeOutlet?.id, defaultSourceOutletId, defaultItemType]);

  // 2. Sinkronisasi targetOutletId
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
    const src = outlets.find((o) => o.id === newSourceId);
    if (src?.isWarehouse) {
      setItemType('RAW');
    }
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

  // 3. Load item daftar barang berdasarkan itemType & sourceOutletId
  useEffect(() => {
    if (!isOpen || !sourceOutletId) return;

    setLoadingItems(true);

    if (itemType === 'RAW') {
      api.getRecipeInventoryItems(sourceOutletId, 'all')
        .then((res) => {
          if (res.status === 'success' && res.data) {
            setSourceRawItems(res.data);
            if (!selectedRawItemId || !res.data.some((it) => it.id === selectedRawItemId)) {
              setSelectedRawItemId(defaultInventoryItemId || res.data[0]?.id || '');
            }
          }
        })
        .catch((err) => console.error('Gagal mengambil bahan baku gudang/toko asal:', err))
        .finally(() => setLoadingItems(false));
    } else {
      if (sourceOutletId === activeOutlet?.id && products.length > 0) {
        setSourceProducts(products);
        if (!selectedProductId || !products.some((p) => p.id === selectedProductId)) {
          setSelectedProductId(products[0]?.id || '');
        }
        setLoadingItems(false);
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
        .catch((err) => console.error('Gagal mengambil produk toko asal:', err))
        .finally(() => setLoadingItems(false));
    }
  }, [sourceOutletId, itemType, isOpen, activeOutlet?.id, products, defaultInventoryItemId]);

  if (!isOpen) return null;

  const sourceOutlet = outlets.find((o) => o.id === sourceOutletId);
  const targetOutlet = outlets.find((o) => o.id === targetOutletId);

  const selectedProduct = sourceProducts.find((p) => p.id === selectedProductId);
  const selectedRawItem = sourceRawItems.find((it) => it.id === selectedRawItemId);

  const availableStock = itemType === 'RAW'
    ? (selectedRawItem?.stock ?? selectedRawItem?.warehouseStock ?? 0)
    : (selectedProduct?.stock ?? 0);

  const itemUnit = itemType === 'RAW'
    ? (selectedRawItem?.canonicalUom || 'Satuan')
    : (selectedProduct?.unit || 'Pcs');

  const itemName = itemType === 'RAW'
    ? selectedRawItem?.name
    : selectedProduct?.name;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!sourceOutletId || !targetOutletId) {
      setError('Lokasi asal dan tujuan wajib dipilih');
      return;
    }

    if (sourceOutletId === targetOutletId) {
      setError('Lokasi asal dan tujuan tidak boleh sama');
      return;
    }

    if (itemType === 'RAW' && !selectedRawItemId) {
      setError('Silakan pilih bahan baku yang akan ditransfer');
      return;
    }

    if (itemType === 'PRODUCT' && !selectedProductId) {
      setError('Silakan pilih produk yang akan ditransfer');
      return;
    }

    if (quantity <= 0) {
      setError('Jumlah transfer harus lebih dari 0');
      return;
    }

    if (quantity > availableStock) {
      setError(`Stok di lokasi asal tidak mencukupi (Tersedia: ${availableStock.toLocaleString('id-ID')} ${itemUnit})`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = itemType === 'RAW'
        ? {
            sourceOutletId,
            targetOutletId,
            inventoryItemId: selectedRawItemId,
            quantity,
            notes: notes.trim() || undefined,
          }
        : {
            sourceOutletId,
            targetOutletId,
            productId: selectedProductId,
            quantity,
            notes: notes.trim() || undefined,
          };

      const res = await api.transferStock(payload);

      if (res.status === 'success') {
        onSuccess();
        onClose();
      } else {
        setError(res.message || 'Gagal mentransfer stok');
      }
    } catch (err: any) {
      setError(err?.message || 'Terjadi kesalahan sistem saat transfer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-900 rounded-2xl border border-blue-100">
              <ArrowLeftRight className="w-5 h-5 text-blue-900" />
            </div>
            <div>
              <h3 className="font-extrabold text-blue-950 text-base">Transfer & Alokasi Stok</h3>
              <p className="text-xs text-slate-500 font-medium">
                Pindahkan persediaan antar Gudang dan Outlet Toko
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-800 text-xs animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-medium leading-relaxed">{error}</span>
            </div>
          )}

          {/* Pemilihan Lokasi Asal & Tujuan */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl relative">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    {sourceOutlet?.isWarehouse ? (
                      <Warehouse className="w-3.5 h-3.5 text-indigo-700" />
                    ) : (
                      <Store className="w-3.5 h-3.5 text-blue-900" />
                    )}
                    <span>Dari (Asal Pasokan)</span>
                  </label>
                  {sourceOutlet?.isWarehouse ? (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Gudang
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200">
                      Toko
                    </span>
                  )}
                </div>
                <select
                  value={sourceOutletId}
                  onChange={(e) => handleSourceChange(e.target.value)}
                  disabled={loadingOutlets || submitting}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                >
                  {outlets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.isWarehouse ? '🏭 [Gudang]' : '🏪 [Toko]'} {o.name}
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
                      <Store className="w-3.5 h-3.5 text-emerald-700" />
                    )}
                    <span>Ke (Tujuan Penerima)</span>
                  </label>
                  {targetOutlet?.isWarehouse ? (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Gudang
                    </span>
                  ) : (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Toko
                    </span>
                  )}
                </div>
                <select
                  value={targetOutletId}
                  onChange={(e) => handleTargetChange(e.target.value)}
                  disabled={loadingOutlets || submitting}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-blue-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                >
                  {outlets
                    .filter((o) => o.id !== sourceOutletId)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.isWarehouse ? '🏭 [Gudang]' : '🏪 [Toko]'} {o.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Tombol Swap */}
            <div className="flex justify-center mt-2">
              <button
                type="button"
                onClick={handleSwapOutlets}
                className="text-[11px] font-bold text-slate-500 hover:text-blue-900 bg-white border border-slate-200 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs hover:bg-slate-50 transition-all cursor-pointer"
                title="Tukar Asal dan Tujuan"
              >
                <ArrowLeftRight className="w-3 h-3 text-slate-400" />
                <span>Tukar Arah</span>
              </button>
            </div>
          </div>

          {/* Pilihan Tipe Item (Bahan Baku vs Produk Retail) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Jenis Barang yang Ditransfer
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setItemType('RAW')}
                className={`py-2 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  itemType === 'RAW'
                    ? 'bg-blue-50 border-blue-500 text-blue-950 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Boxes className={`w-4 h-4 ${itemType === 'RAW' ? 'text-blue-900' : 'text-slate-400'}`} />
                <span>Bahan Baku / BOM</span>
              </button>

              <button
                type="button"
                onClick={() => setItemType('PRODUCT')}
                className={`py-2 px-3 rounded-xl border text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  itemType === 'PRODUCT'
                    ? 'bg-blue-50 border-blue-500 text-blue-950 shadow-xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                <Package className={`w-4 h-4 ${itemType === 'PRODUCT' ? 'text-blue-900' : 'text-slate-400'}`} />
                <span>Produk Jadi Retail</span>
              </button>
            </div>
          </div>

          {/* Pemilihan Barang / Item */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                {itemType === 'RAW' ? <Boxes className="w-3.5 h-3.5 text-blue-900" /> : <Package className="w-3.5 h-3.5 text-blue-900" />}
                <span>{itemType === 'RAW' ? 'Pilih Bahan Baku' : 'Pilih Produk Retail'}</span>
              </span>
              {itemName && (
                <span className="text-[11px] font-bold text-blue-900 bg-blue-50 px-2.5 py-0.5 rounded-md border border-blue-200">
                  Stok Asal: {availableStock.toLocaleString('id-ID')} {itemUnit}
                </span>
              )}
            </label>

            {loadingItems ? (
              <div className="py-2.5 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
                Memuat daftar stok barang...
              </div>
            ) : itemType === 'RAW' ? (
              <select
                value={selectedRawItemId}
                onChange={(e) => setSelectedRawItemId(e.target.value)}
                disabled={submitting || sourceRawItems.length === 0}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {sourceRawItems.length === 0 ? (
                  <option value="">Tidak ada bahan baku di lokasi ini</option>
                ) : (
                  sourceRawItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      [{it.itemCode || 'RAW'}] {it.name} - Stok: {(it.stock ?? it.warehouseStock ?? 0).toLocaleString('id-ID')} {it.canonicalUom}
                    </option>
                  ))
                )}
              </select>
            ) : (
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                disabled={submitting || sourceProducts.length === 0}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {sourceProducts.length === 0 ? (
                  <option value="">Tidak ada produk retail di lokasi ini</option>
                ) : (
                  sourceProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name} - Stok: {p.stock.toLocaleString('id-ID')} {p.unit}
                    </option>
                  ))
                )}
              </select>
            )}
          </div>

          {/* Jumlah Qty Transfer */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Jumlah Transfer ({itemUnit})
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0.1"
                step="any"
                max={availableStock}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(0, parseFloat(e.target.value) || 0))}
                disabled={submitting}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-sm font-black text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setQuantity(availableStock)}
                disabled={availableStock <= 0}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50"
              >
                Pindah Semua ({availableStock.toLocaleString('id-ID')})
              </button>
            </div>
          </div>

          {/* Catatan Transfer */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Catatan / Keterangan Mutasi</span>
            </label>
            <input
              type="text"
              placeholder="Contoh: Pasokan Bahan Baku Mingguan / Surat Jalan #WH-001"
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
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || availableStock <= 0 || quantity <= 0}
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
