import React, { useState, useEffect } from 'react';
import { X, ArrowDownRight, ArrowUpRight, SlidersHorizontal, Check, AlertCircle, Warehouse } from 'lucide-react';
import type { Product } from '../types/product';
import type { Outlet } from '../types/outlet';
import { api } from '../services/api';
import { CurrencyInput } from './ui/CurrencyInput';

interface StockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  products?: Product[];
  defaultProduct?: Product | null;
  defaultIngredient?: {
    id: string;
    itemCode?: string;
    name: string;
    canonicalUom: string;
    averageCost?: number;
    stock?: number;
  } | null;
  defaultType?: 'IN' | 'OUT' | 'ADJUST';
  outletId?: string;
}

export const StockMovementModal: React.FC<StockMovementModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  products = [],
  defaultProduct,
  defaultIngredient,
  defaultType = 'IN',
  outletId,
}) => {
  const [type, setType] = useState<'IN' | 'OUT' | 'ADJUST'>('IN');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [actualStock, setActualStock] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [poNumber, setPoNumber] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [newCostPrice, setNewCostPrice] = useState<string>('');

  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [targetOutletId, setTargetOutletId] = useState<string>(outletId || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentProduct = products.find((p) => p.id === selectedProductId);

  useEffect(() => {
    setType(defaultType);
    if (defaultIngredient) {
      setActualStock(defaultIngredient.stock || 0);
      setNewCostPrice(String(defaultIngredient.averageCost || ''));
    } else if (defaultProduct) {
      setSelectedProductId(defaultProduct.id);
      setActualStock(defaultProduct.stock);
      setNewCostPrice(String(defaultProduct.costPrice || ''));
    } else if (products.length > 0) {
      setSelectedProductId(products[0].id);
      setActualStock(products[0].stock);
      setNewCostPrice(String(products[0].costPrice || ''));
    }
    setQuantity(1);
    setNotes('');
    setPoNumber('');
    setSupplierName('');
    setError(null);

    // Ambil daftar outlet untuk dropdown tujuan lokasi
    if (isOpen) {
      api.getOutlets().then((res) => {
        if (res.status === 'success' && res.data) {
          setOutlets(res.data);
          if (outletId) {
            setTargetOutletId(outletId);
          } else if (res.data.length > 0) {
            // Prioritaskan Gudang Pusat jika ada, atau outlet pertama
            const warehouse = res.data.find((o: Outlet) => o.isWarehouse);
            setTargetOutletId(warehouse ? warehouse.id : res.data[0].id);
          }
        }
      }).catch((err) => console.error('Gagal mengambil daftar outlet:', err));
    }
  }, [defaultProduct, defaultIngredient, defaultType, products, isOpen, outletId]);

  useEffect(() => {
    if (currentProduct && !defaultIngredient) {
      setActualStock(currentProduct.stock);
      setNewCostPrice(String(currentProduct.costPrice || ''));
    }
  }, [selectedProductId, defaultIngredient]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!defaultIngredient && !selectedProductId) return;

    setError(null);
    setLoading(true);

    try {
      if (defaultIngredient) {
        // Alur Mutasi Bahan Baku Mentah
        if (type === 'IN') {
          const res = await api.recordStockIn({
            inventoryItemId: defaultIngredient.id,
            quantity: Number(quantity),
            notes,
            poNumber: poNumber.trim() || undefined,
            supplierName: supplierName.trim() || undefined,
            newCostPrice: newCostPrice ? Number(newCostPrice) : undefined,
            outletId: targetOutletId || outletId,
          });
          if (res.status === 'success') {
            onSuccess();
            onClose();
          } else {
            setError(res.message || 'Gagal mencatat stok masuk');
          }
        } else if (type === 'OUT') {
          const currentBal = Number(defaultIngredient.stock || 0);
          const res = await api.recordStockAdjustment({
            inventoryItemId: defaultIngredient.id,
            actualStock: Math.max(0, currentBal - Number(quantity)),
            notes: notes ? `Stok keluar: ${notes}` : 'Barang rusak / terbuang',
            outletId: targetOutletId || outletId,
          });
          if (res.status === 'success') {
            onSuccess();
            onClose();
          } else {
            setError(res.message || 'Gagal mencatat stok keluar');
          }
        } else {
          const res = await api.recordStockAdjustment({
            inventoryItemId: defaultIngredient.id,
            actualStock: Number(actualStock),
            notes: notes || 'Opname fisik dapur/gudang',
            outletId: targetOutletId || outletId,
          });
          if (res.status === 'success') {
            onSuccess();
            onClose();
          } else {
            setError(res.message || 'Gagal mencatat penyesuaian stok');
          }
        }
      } else {
        // Alur Mutasi Produk Jadi Retail
        if (type === 'IN') {
          const res = await api.recordStockIn({
            productId: selectedProductId,
            quantity: Number(quantity),
            notes,
            poNumber: poNumber.trim() || undefined,
            supplierName: supplierName.trim() || undefined,
            newCostPrice: newCostPrice ? Number(newCostPrice) : undefined,
            outletId: targetOutletId || outletId,
          });
          if (res.status === 'success') {
            onSuccess();
            onClose();
          } else {
            setError(res.message || 'Gagal mencatat stok masuk');
          }
        } else if (type === 'OUT') {
          const res = await api.recordStockOut({
            productId: selectedProductId,
            quantity: Number(quantity),
            notes,
            outletId: targetOutletId || outletId,
          });
          if (res.status === 'success') {
            onSuccess();
            onClose();
          } else {
            setError(res.message || 'Gagal mencatat stok keluar');
          }
        } else {
          const res = await api.recordStockAdjustment({
            productId: selectedProductId,
            actualStock: Number(actualStock),
            notes,
            outletId: targetOutletId || outletId,
          });
          if (res.status === 'success') {
            onSuccess();
            onClose();
          } else {
            setError(res.message || 'Gagal mencatat penyesuaian stok');
          }
        }
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header Modal */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <h3 className="font-extrabold text-blue-950 text-base sm:text-lg">
              Mutasi Inventori Stok
            </h3>
            <p className="text-xs text-slate-500">
              Pencatatan mutasi kartu stok dan audit fisik toko
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Jenis Mutasi */}
        <div className="p-6 pb-0">
          <div className="grid grid-cols-3 p-1 bg-slate-100 border border-slate-200 rounded-2xl mb-4">
            <button
              type="button"
              onClick={() => setType('IN')}
              className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
                type === 'IN'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5 text-emerald-300" />
              Stok Masuk
            </button>
            <button
              type="button"
              onClick={() => setType('OUT')}
              className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
                type === 'OUT'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-300" />
              Stok Keluar
            </button>
            <button
              type="button"
              onClick={() => setType('ADJUST')}
              className={`py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1 ${
                type === 'ADJUST'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-300" />
              Opname
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 pt-2 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-700 font-medium">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Lokasi / Gudang Tujuan Mutasi */}
          {outlets.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  {type === 'IN' ? 'Lokasi Penerimaan Stok (Gudang / Outlet Toko) *' : 'Lokasi Toko / Gudang *'}
                </label>
                {outlets.find((o) => o.id === targetOutletId)?.isWarehouse && (
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                    <Warehouse className="w-2.5 h-2.5" /> Gudang Pusat
                  </span>
                )}
              </div>
              <select
                value={targetOutletId}
                onChange={(e) => setTargetOutletId(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all outline-none font-medium"
              >
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.isWarehouse ? '🏭 [Gudang Pusat]' : '🏪 [Toko]'} {o.name}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 mt-1">
                {type === 'IN'
                  ? 'Anda dapat menerima barang langsung di Gudang Pusat untuk kemudian ditransfer, atau langsung di outlet toko tertentu.'
                  : 'Pilih lokasi di mana perubahan stok fisik ini terjadi.'}
              </p>
            </div>
          )}

          {/* Pilih Produk atau Info Bahan Baku */}
          {defaultIngredient ? (
            <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">
                  Bahan Baku Mentah F&amp;B
                </span>
                <h4 className="text-sm font-extrabold text-blue-950">{defaultIngredient.name}</h4>
                <p className="text-xs text-slate-500 font-medium">
                  Kode: {defaultIngredient.itemCode || '-'} • Satuan: {defaultIngredient.canonicalUom}
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 block">Stok Saat Ini</span>
                <span className="text-sm font-black text-blue-900">
                  {defaultIngredient.stock || 0} {defaultIngredient.canonicalUom}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pilih Produk *
              </label>
              <select
                required
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all outline-none"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    [{p.sku}] {p.name} (Stok saat ini: {p.stock} {p.unit})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Info Stok Saat Ini untuk Produk */}
          {!defaultIngredient && currentProduct && (
            <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs text-blue-950 font-semibold">
              <span>Stok Riil Sistem Sekarang:</span>
              <span className="font-extrabold text-sm text-blue-900">
                {currentProduct.stock} {currentProduct.unit}
              </span>
            </div>
          )}

          {/* Input Quantity / Opname */}
          {type === 'ADJUST' ? (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Stok Fisik Hasil Opname ({defaultIngredient ? defaultIngredient.canonicalUom : (currentProduct?.unit || 'Satuan')}) *
              </label>
              <input
                type="number"
                required
                min={0}
                value={actualStock}
                onChange={(e) => setActualStock(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all outline-none font-bold"
              />
              {defaultIngredient ? (
                <p className="text-[11px] text-slate-500 mt-1">
                  Selisih: {actualStock - (defaultIngredient.stock || 0) > 0 ? `+${actualStock - (defaultIngredient.stock || 0)}` : actualStock - (defaultIngredient.stock || 0)} {defaultIngredient.canonicalUom}
                </p>
              ) : currentProduct ? (
                <p className="text-[11px] text-slate-500 mt-1">
                  Selisih: {actualStock - currentProduct.stock > 0 ? `+${actualStock - currentProduct.stock}` : actualStock - currentProduct.stock} {currentProduct.unit}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {type === 'IN' ? 'Jumlah Stok Masuk (+)' : 'Jumlah Stok Keluar / Rusak (-)'} *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={type === 'OUT' && currentProduct ? currentProduct.stock : undefined}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all outline-none font-bold"
                />
              </div>

              {type === 'IN' && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Detail Purchase Order (PO) & Harga Beli (Opsional)
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        No. Faktur / PO:
                      </label>
                      <input
                        type="text"
                        value={poNumber}
                        onChange={(e) => setPoNumber(e.target.value)}
                        placeholder="misal: PO-2026-081"
                        className="w-full bg-white border border-slate-300 focus:border-blue-900 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                        Nama Supplier:
                      </label>
                      <input
                        type="text"
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                        placeholder="misal: CV Bintang Jaya"
                        className="w-full bg-white border border-slate-300 focus:border-blue-900 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">
                      Perbarui Harga Modal Beli (HPP Satuan):
                    </label>
                    <CurrencyInput
                      value={newCostPrice}
                      onChange={(val) => setNewCostPrice(val > 0 ? String(val) : '')}
                      inputClassName="py-1.5 text-xs text-slate-800 font-bold text-right"
                      prefixClassName="text-[11px] py-0.5 px-1.5"
                      placeholder="Biarkan kosong jika tidak ada perubahan HPP"
                    />
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Harga modal saat ini: Rp {Number(currentProduct?.costPrice || 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Catatan Alasan Mutasi */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {type === 'ADJUST' ? 'Alasan Penyesuaian Opname *' : 'Catatan Mutasi (Supplier / Alasan Rusak)'}
            </label>
            <input
              type="text"
              required={type === 'ADJUST'}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                type === 'IN'
                  ? 'misal: Penerimaan PO dari Supplier Sari Rasa'
                  : type === 'OUT'
                  ? 'misal: Kaleng penyok / Kemasan sobek di rak 2'
                  : 'misal: Hasil stock opname berkala akhir pekan'
              }
              className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all outline-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-[0.98] disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-900/20 transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {loading ? 'Menyimpan Mutasi...' : 'Eksekusi Mutasi'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
