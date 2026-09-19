import React, { useState, useEffect } from 'react';
import { X, Search, Check, Plus, AlertCircle, ShoppingBag } from 'lucide-react';
import { api } from '../services/api';

interface AssignCatalogProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  outletId?: string;
  onSuccess: () => void;
}

export const AssignCatalogProductModal: React.FC<AssignCatalogProductModalProps> = ({
  isOpen,
  onClose,
  outletId,
  onSuccess,
}) => {
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<{ [id: string]: { selected: boolean; initialStock: number } }>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && outletId) {
      loadAvailableProducts();
      setSelectedItems({});
      setErrorMsg('');
    }
  }, [isOpen, outletId]);

  const loadAvailableProducts = async () => {
    if (!outletId) return;
    setLoading(true);
    try {
      const res = await api.getAvailableProductsForOutlet(outletId, searchTerm);
      if (res.status === 'success' && Array.isArray(res.data)) {
        setAvailableProducts(res.data);
      }
    } catch (err: any) {
      console.error('Gagal memuat produk tersedia:', err);
      setErrorMsg('Gagal memuat produk katalog');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedItems((prev) => {
      const isCurrentlySelected = prev[id]?.selected ?? false;
      return {
        ...prev,
        [id]: {
          selected: !isCurrentlySelected,
          initialStock: prev[id]?.initialStock ?? 10,
        },
      };
    });
  };

  const updateStock = (id: string, stock: number) => {
    setSelectedItems((prev) => ({
      ...prev,
      [id]: {
        selected: true,
        initialStock: Math.max(0, stock),
      },
    }));
  };

  const handleAssign = async () => {
    if (!outletId) return;
    const selectedProductIds = Object.keys(selectedItems).filter((id) => selectedItems[id]?.selected);
    if (selectedProductIds.length === 0) {
      setErrorMsg('Pilih minimal 1 produk untuk dihubungkan');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const assignments = selectedProductIds.map((id) => ({
        productId: id,
        initialStock: selectedItems[id].initialStock || 0,
      }));

      const res = await api.assignProductsToOutlet({
        outletId,
        assignments,
      });

      if (res.status === 'success') {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.message || 'Gagal menghubungkan produk');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const countSelected = Object.values(selectedItems).filter((v) => v.selected).length;
  const filteredProducts = availableProducts.filter((p) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.barcode && p.barcode.includes(searchTerm)) ||
    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-900/10 text-blue-900 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-blue-950">Ambil Produk dari Master Katalog</h3>
              <p className="text-xs text-slate-500">Hubungkan produk yang sudah ada ke cabang aktif ini</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari nama produk, SKU, atau barcode..."
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
            />
          </div>
        </div>

        {/* Error Notification */}
        {errorMsg && (
          <div className="mx-6 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* List of Available Products */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-xs text-slate-500">Memuat katalog produk tersedia...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">
                {availableProducts.length === 0
                  ? 'Semua produk katalog sudah terhubung dengan cabang ini.'
                  : 'Tidak ada produk yang cocok dengan pencarian.'}
              </p>
            </div>
          ) : (
            filteredProducts.map((prod) => {
              const isChecked = selectedItems[prod.id]?.selected ?? false;
              const stockVal = selectedItems[prod.id]?.initialStock ?? 10;
              return (
                <div
                  key={prod.id}
                  onClick={() => toggleSelect(prod.id)}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                    isChecked
                      ? 'bg-blue-50/70 border-blue-300 shadow-xs'
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-5 h-5 rounded-lg border flex items-center justify-center transition-all shrink-0 ${
                        isChecked ? 'bg-blue-900 border-blue-900 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>

                    {prod.imageUrl ? (
                      <img
                        src={prod.imageUrl}
                        alt={prod.name}
                        className="w-10 h-10 rounded-xl object-cover border border-slate-100 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0 text-xs font-bold">
                        {prod.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <h4 className="font-bold text-xs sm:text-sm text-blue-950 truncate">{prod.name}</h4>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-medium">
                          {prod.category?.name || 'Tanpa Kategori'}
                        </span>
                        <span>Rp {prod.basePrice?.toLocaleString('id-ID')}</span>
                      </div>
                    </div>
                  </div>

                  {isChecked && (
                    <div
                      className="flex items-center gap-1.5 shrink-0 bg-white px-2.5 py-1.5 rounded-xl border border-blue-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Stok Awal:</span>
                      <input
                        type="number"
                        min="0"
                        value={stockVal}
                        onChange={(e) => updateStock(prod.id, parseInt(e.target.value) || 0)}
                        className="w-16 text-center text-xs font-bold border border-slate-200 rounded-lg py-0.5 px-1 focus:outline-hidden focus:border-blue-900"
                      />
                      <span className="text-[10px] text-slate-500 font-bold">{prod.unit || 'Pcs'}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-600">
            {countSelected > 0 ? `${countSelected} produk dipilih` : 'Pilih produk yang ingin ditambahkan'}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleAssign}
              disabled={countSelected === 0 || submitting}
              className="px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-blue-900/20 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{submitting ? 'Menghubungkan...' : `Hubungkan ke Cabang (${countSelected})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
