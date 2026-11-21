import React, { useRef, useState, useMemo, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Minus,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
  X,
  TrendingUp,
  AlertCircle,
  Check,
  Tag,
  Store,
  Utensils,
} from 'lucide-react';
import type { Product } from '../../types/product';
import { CurrencyInput } from '../ui/CurrencyInput';
import { useDialog } from '../../context/DialogContext';

export interface BundleItem {
  childProductId: string;
  childVariantId?: string | null;
  childProductName: string;
  childUnit: string;
  childAverageCost: number;
  childBasePrice: number;
  quantity: number;
  slotName?: string;
  priceAdjustment?: number;
  isDefault?: boolean;
}

export interface PriceTier {
  minQuantity: number;
  tierPrice: number;
}

interface ProductBundlingTabProps {
  productMode: 'STANDARD' | 'FNB' | 'COMPOSITE';
  setProductMode: (mode: 'STANDARD' | 'FNB' | 'COMPOSITE') => void;
  availableProducts: Product[];
  bundleItems: BundleItem[];
  setBundleItems: React.Dispatch<React.SetStateAction<BundleItem[]>>;
  basePrice: number;
  costPrice: number;
  setCostPrice: (val: number) => void;
  unit: string;
  priceTiers: PriceTier[];
  setPriceTiers: React.Dispatch<React.SetStateAction<PriceTier[]>>;
  showPriceTiers: boolean;
  setShowPriceTiers: (val: boolean) => void;
}

export const ProductBundlingTab: React.FC<ProductBundlingTabProps> = ({
  productMode,
  setProductMode,
  availableProducts,
  bundleItems,
  setBundleItems,
  basePrice,
  costPrice,
  setCostPrice,
  unit,
  priceTiers,
  setPriceTiers,
  showPriceTiers,
  setShowPriceTiers,
}) => {
  const dialog = useDialog();

  const [selectedChildId, setSelectedChildId] = useState('');
  const [selectedChildQty, setSelectedChildQty] = useState<number>(1);
  const [childSearch, setChildSearch] = useState('');
  const [childFilterType, setChildFilterType] = useState<'ALL' | 'RETAIL' | 'FNB'>('ALL');
  const [isChildDropdownOpen, setIsChildDropdownOpen] = useState(false);
  const childDropdownRef = useRef<HTMLDivElement>(null);

  const [newTierMinQty, setNewTierMinQty] = useState<number | string>(3);
  const [newTierPrice, setNewTierPrice] = useState<number>(0);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (childDropdownRef.current && !childDropdownRef.current.contains(event.target as Node)) {
        setIsChildDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const filteredAvailableProducts = useMemo(() => {
    return availableProducts.filter((p) => {
      if (childFilterType === 'RETAIL' && (p.hasRecipe || p.productType === 'COMPOSITE')) return false;
      if (childFilterType === 'FNB' && !p.hasRecipe) return false;

      if (!childSearch.trim()) return true;
      const q = childSearch.toLowerCase().trim();
      const matchName = p.name.toLowerCase().includes(q);
      const matchSku = p.sku ? p.sku.toLowerCase().includes(q) : false;
      const matchCat = p.category?.name ? p.category.name.toLowerCase().includes(q) : false;
      return matchName || matchSku || matchCat;
    });
  }, [availableProducts, childFilterType, childSearch]);

  const handleAddBundleItem = (productToAdd?: Product) => {
    const targetId = productToAdd ? productToAdd.id : selectedChildId;
    if (!targetId) return;
    const prod = productToAdd || availableProducts.find((p) => p.id === targetId);
    if (!prod) return;

    if (bundleItems.some((bi) => bi.childProductId === targetId)) {
      dialog.alert({
        title: 'Komponen Sudah Ada',
        message: `Produk "${prod.name}" sudah terdaftar di dalam paket ini. Anda dapat langsung mengatur rasio kuantitasnya pada tabel di bawah.`,
        variant: 'warning',
      });
      return;
    }

    setBundleItems((prev) => [
      ...prev,
      {
        childProductId: prod.id,
        childVariantId: prod.variants?.[0]?.id || null,
        childProductName: prod.name,
        childUnit: prod.unit || 'Pcs',
        childAverageCost: prod.costPrice || 0,
        childBasePrice: prod.price || prod.basePrice || 0,
        quantity: Math.max(1, Number(selectedChildQty) || 1),
      },
    ]);
    setSelectedChildId('');
    setSelectedChildQty(1);
    setIsChildDropdownOpen(false);
    setChildSearch('');
  };

  const handleUpdateBundleItemQty = (childId: string, delta: number) => {
    setBundleItems((prev) =>
      prev.map((bi) => {
        if (bi.childProductId === childId) {
          const nextQty = Math.max(1, bi.quantity + delta);
          return { ...bi, quantity: nextQty };
        }
        return bi;
      })
    );
  };

  const handleRemoveBundleItem = (childId: string) => {
    setBundleItems((prev) => prev.filter((bi) => bi.childProductId !== childId));
  };

  const handleUpdateBundleItemSlot = (childId: string, slotName: string) => {
    setBundleItems((prev) =>
      prev.map((bi) => (bi.childProductId === childId ? { ...bi, slotName } : bi))
    );
  };

  const handleUpdateBundleItemPriceAdjustment = (childId: string, priceAdjustment: number) => {
    setBundleItems((prev) =>
      prev.map((bi) => (bi.childProductId === childId ? { ...bi, priceAdjustment } : bi))
    );
  };

  const handleUpdateBundleItemDefault = (childId: string, isDefault: boolean) => {
    setBundleItems((prev) => {
      const currentSlot = prev.find((p) => p.childProductId === childId)?.slotName;
      return prev.map((bi) => {
        if (bi.childProductId === childId) {
          return { ...bi, isDefault };
        }
        if (isDefault && currentSlot && bi.slotName === currentSlot) {
          return { ...bi, isDefault: false };
        }
        return bi;
      });
    });
  };

  const estimatedBundleHpp = bundleItems.reduce(
    (acc, bi) => acc + bi.childAverageCost * bi.quantity,
    0
  );

  const handleAddPriceTier = () => {
    const minQty = Number(newTierMinQty);
    if (!minQty || minQty < 2) {
      dialog.alert({
        title: 'Minimal Beli Tidak Valid',
        message: 'Minimal pembelian untuk harga grosir harus minimal 2 unit (pembelian 1 unit menggunakan Harga Jual Reguler).',
        variant: 'warning',
      });
      return;
    }
    if (newTierPrice <= 0) {
      dialog.alert({
        title: 'Harga Grosir Tidak Valid',
        message: 'Harga grosir harus lebih besar dari Rp 0.',
        variant: 'warning',
      });
      return;
    }
    if (priceTiers.some((pt) => pt.minQuantity === minQty)) {
      dialog.alert({
        title: 'Tier Sudah Terdaftar',
        message: `Tingkat harga grosir untuk minimal ${minQty} unit sudah ada.`,
        variant: 'warning',
      });
      return;
    }

    setPriceTiers((prev) =>
      [...prev, { minQuantity: minQty, tierPrice: newTierPrice }].sort(
        (a, b) => a.minQuantity - b.minQuantity
      )
    );
    setNewTierMinQty(minQty + 2);
    setNewTierPrice(0);
  };

  const handleRemovePriceTier = (minQty: number) => {
    setPriceTiers((prev) => prev.filter((pt) => pt.minQuantity !== minQty));
  };

  return (
    <div className="space-y-5 text-slate-800">
      {/* Segmented Mode: Standar Ritel vs Paket Komposit Bundling */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-extrabold text-slate-800 block">
              Tipe Pengelolaan Produk
            </span>
            <span className="text-[11px] text-slate-500">
              Pilih apakah produk ini adalah barang ritel biasa atau paket bundling dari beberapa barang.
            </span>
          </div>

          <div className="inline-flex bg-slate-200/80 p-1 rounded-xl self-start sm:self-auto gap-1">
            <button
              type="button"
              onClick={() => setProductMode('STANDARD')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                productMode === 'STANDARD'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Store className="w-3.5 h-3.5 text-emerald-600" />
              <span>Barang Satuan (Ritel)</span>
            </button>
            <button
              type="button"
              onClick={() => setProductMode('COMPOSITE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                productMode === 'COMPOSITE'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Boxes className="w-3.5 h-3.5 text-amber-600" />
              <span>Paket Bundling (Komposit)</span>
            </button>
          </div>
        </div>

        {productMode === 'COMPOSITE' && (
          <div className="space-y-4 pt-3 border-t border-slate-200">
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-start gap-2.5">
              <Boxes className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-950">
                <p className="font-bold">Paket Komposit / Bundling (Multi-Produk)</p>
                <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                  Daftarkan produk-produk satuan yang menyusun paket ini. Saat kasir menjual paket ini, sistem otomatis memotong stok fisik atau bahan baku dari masing-masing produk anak secara proporsional.
                </p>
              </div>
            </div>

            {/* Form Tambah Produk Anak ke Paket (Searchable Combobox) */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-blue-900" />
                  Pilih & Tambah Komponen Anak
                </span>
                <span className="text-[11px] text-slate-400 font-medium">
                  Tersedia {availableProducts.length} produk katalog
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-start">
                <div className="sm:col-span-8 relative" ref={childDropdownRef}>
                  {selectedChildId ? (
                    (() => {
                      const sel = availableProducts.find((p) => p.id === selectedChildId);
                      if (!sel) return null;
                      const isRetail = !sel.hasRecipe && sel.productType !== 'COMPOSITE';
                      return (
                        <div className="w-full bg-blue-50/70 border border-blue-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2 shadow-2xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {sel.imageUrl ? (
                              <img
                                src={sel.imageUrl}
                                alt={sel.name}
                                className="w-8 h-8 rounded-lg object-cover shrink-0 border border-blue-200"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0 text-blue-900">
                                {isRetail ? <Store className="w-4 h-4" /> : <Utensils className="w-4 h-4" />}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-900 truncate">{sel.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span
                                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                    isRetail
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-blue-100 text-blue-800'
                                  }`}
                                >
                                  {isRetail ? `Stok: ${sel.stock} ${sel.unit || 'Pcs'}` : 'Resep F&B'}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                  HPP: Rp {Number(sel.costPrice || 0).toLocaleString('id-ID')}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => setSelectedChildId('')}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition-colors cursor-pointer"
                              title="Ganti produk"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsChildDropdownOpen(!isChildDropdownOpen)}
                              className="p-1 text-blue-900 hover:bg-white rounded-lg transition-colors cursor-pointer"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsChildDropdownOpen(!isChildDropdownOpen)}
                      className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 hover:border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-700 outline-none transition-all cursor-pointer flex items-center justify-between text-left shadow-2xs"
                    >
                      <span className="flex items-center gap-2 text-slate-500">
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                        <span>Cari & pilih produk komponen anak...</span>
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    </button>
                  )}

                  {isChildDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-2xl shadow-2xl p-2.5 space-y-2 animate-fadeIn max-w-full">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          autoFocus
                          type="text"
                          value={childSearch}
                          onChange={(e) => setChildSearch(e.target.value)}
                          placeholder="Ketik nama produk, SKU, atau kategori..."
                          className="w-full pl-8 pr-7 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-900 focus:bg-white font-medium text-slate-800"
                        />
                        {childSearch && (
                          <button
                            type="button"
                            onClick={() => setChildSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2 overflow-x-auto text-[10px]">
                        <button
                          type="button"
                          onClick={() => setChildFilterType('ALL')}
                          className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                            childFilterType === 'ALL'
                              ? 'bg-blue-900 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Semua ({availableProducts.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setChildFilterType('RETAIL')}
                          className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                            childFilterType === 'RETAIL'
                              ? 'bg-emerald-800 text-white'
                              : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                          }`}
                        >
                          <Store className="w-2.5 h-2.5" />
                          Ritel Fisik ({availableProducts.filter((p) => !p.hasRecipe && p.productType !== 'COMPOSITE').length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setChildFilterType('FNB')}
                          className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                            childFilterType === 'FNB'
                              ? 'bg-blue-800 text-white'
                              : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
                          }`}
                        >
                          <Utensils className="w-2.5 h-2.5" />
                          Resep F&B ({availableProducts.filter((p) => p.hasRecipe).length})
                        </button>
                      </div>

                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 pr-0.5 space-y-0.5">
                        {filteredAvailableProducts.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-400">
                            Tidak ada produk yang cocok dengan pencarian &quot;{childSearch}&quot;.
                          </div>
                        ) : (
                          filteredAvailableProducts.map((p) => {
                            const isRetail = !p.hasRecipe && p.productType !== 'COMPOSITE';
                            const existingInBundle = bundleItems.find((bi) => bi.childProductId === p.id);
                            const isSelected = selectedChildId === p.id;

                            return (
                              <div
                                key={p.id}
                                onClick={() => {
                                  setSelectedChildId(p.id);
                                  setIsChildDropdownOpen(false);
                                }}
                                className={`p-2 rounded-xl flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                                  isSelected ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {p.imageUrl ? (
                                    <img
                                      src={p.imageUrl}
                                      alt={p.name}
                                      className="w-8 h-8 rounded-lg object-cover shrink-0 border border-slate-200"
                                    />
                                  ) : (
                                    <div
                                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                        isRetail ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                                      }`}
                                    >
                                      {isRetail ? <Store className="w-4 h-4" /> : <Utensils className="w-4 h-4" />}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                                      <span>HPP: Rp {Number(p.costPrice || 0).toLocaleString('id-ID')}</span>
                                      <span>•</span>
                                      <span>Jual: Rp {Number(p.basePrice || p.price || 0).toLocaleString('id-ID')}</span>
                                    </div>
                                  </div>
                                </div>

                                {existingInBundle ? (
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                                    Sudah Ada ({existingInBundle.quantity}x)
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddBundleItem(p);
                                    }}
                                    className="px-2.5 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded-lg text-[11px] font-bold transition-all shadow-2xs shrink-0 cursor-pointer"
                                  >
                                    + Tambah
                                  </button>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => setSelectedChildQty((prev) => Math.max(1, prev - 1))}
                      className="px-2 py-2 text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      min={1}
                      value={selectedChildQty}
                      onChange={(e) => setSelectedChildQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      className="w-full text-center text-xs font-bold font-mono outline-none py-2 text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => setSelectedChildQty((prev) => prev + 1)}
                      className="px-2 py-2 text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    disabled={!selectedChildId}
                    onClick={() => handleAddBundleItem()}
                    className="w-full py-2 bg-blue-900 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
                  >
                    + Masukkan
                  </button>
                </div>
              </div>
            </div>

            {/* Daftar Komponen yang Telah Ditambahkan ke Paket */}
            {bundleItems.length === 0 ? (
              <div className="p-4 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-center text-xs text-slate-400">
                Belum ada produk komponen yang ditambahkan ke paket komposit ini.
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100 shadow-2xs">
                <div className="px-3.5 py-2.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6">Komponen Anak</div>
                  <div className="col-span-3 text-center">Rasio Kuantitas</div>
                  <div className="col-span-2 text-right">Estimasi HPP</div>
                  <div className="col-span-1 text-center">Aksi</div>
                </div>

                {bundleItems.map((bi) => {
                  const originalProd = availableProducts.find((p) => p.id === bi.childProductId);
                  const isRetail = originalProd ? !originalProd.hasRecipe && originalProd.productType !== 'COMPOSITE' : false;

                  return (
                    <div key={bi.childProductId} className="px-3.5 py-3 text-xs hover:bg-slate-50/50 transition-colors space-y-2">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-6 min-w-0 flex items-center gap-2.5">
                          {originalProd?.imageUrl ? (
                            <img
                              src={originalProd.imageUrl}
                              alt={bi.childProductName}
                              className="w-8 h-8 rounded-lg object-cover shrink-0 border border-slate-200"
                            />
                          ) : (
                            <div
                              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                isRetail ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {isRetail ? <Store className="w-4 h-4" /> : <Utensils className="w-4 h-4" />}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{bi.childProductName}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  isRetail
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                                }`}
                              >
                                {isRetail ? `Stok: ${originalProd?.stock || 0} ${bi.childUnit}` : 'Resep Dapur'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                Harga Satuan: Rp {Number(bi.childBasePrice || 0).toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="col-span-3 flex items-center justify-center">
                          <div className="inline-flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => handleUpdateBundleItemQty(bi.childProductId, -1)}
                              className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 rounded transition-colors cursor-pointer"
                              title="Kurangi kuantitas"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center font-black font-mono text-xs text-blue-950">
                              {bi.quantity}x
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateBundleItemQty(bi.childProductId, 1)}
                              className="w-6 h-6 flex items-center justify-center text-slate-600 hover:bg-white hover:text-slate-900 rounded transition-colors cursor-pointer"
                              title="Tambah kuantitas"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        <div className="col-span-2 text-right font-mono">
                          <span className="font-black text-slate-900 block text-xs">
                            Rp {(bi.childAverageCost * bi.quantity).toLocaleString('id-ID')}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            @Rp {bi.childAverageCost.toLocaleString('id-ID')}
                          </span>
                        </div>

                        <div className="col-span-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveBundleItem(bi.childProductId)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus komponen dari paket"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 pt-1.5 border-t border-slate-100 text-[11px] bg-slate-50/60 p-2 rounded-xl">
                        <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider shrink-0">Slot Opsi:</span>
                          <input
                            type="text"
                            placeholder="Kosongkan jika komponen tetap (misal: Pilih Minuman)"
                            value={bi.slotName || ''}
                            onChange={(e) => handleUpdateBundleItemSlot(bi.childProductId, e.target.value)}
                            className="flex-1 px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none placeholder:text-slate-400"
                          />
                        </div>
                        {bi.slotName && bi.slotName.trim() !== '' && (
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <span className="text-slate-500 shrink-0 text-[10px] font-bold uppercase">Ekstra:</span>
                              <div className="relative">
                                <span className="absolute left-2 top-1 text-[10px] text-slate-400 font-bold">+Rp</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="500"
                                  placeholder="0"
                                  value={bi.priceAdjustment || ''}
                                  onChange={(e) => handleUpdateBundleItemPriceAdjustment(bi.childProductId, Number(e.target.value || 0))}
                                  className="w-24 pl-8 pr-2 py-1 text-xs font-mono bg-white border border-slate-200 rounded-lg focus:border-blue-500 focus:outline-none"
                                />
                              </div>
                            </div>
                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-700 select-none">
                              <input
                                type="checkbox"
                                checked={Boolean(bi.isDefault)}
                                onChange={(e) => handleUpdateBundleItemDefault(bi.childProductId, e.target.checked)}
                                className="rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
                              />
                              <span className="text-[11px] font-semibold">Opsi Bawaan</span>
                            </label>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div className="p-4 bg-gradient-to-r from-amber-50/70 via-amber-50/40 to-slate-50 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="text-[11px] font-bold text-amber-900 block">
                        Total Estimasi Modal (HPP Paket):
                      </span>
                      <div className="flex items-baseline gap-2">
                        <span className="font-black text-amber-950 text-base font-mono">
                          Rp {estimatedBundleHpp.toLocaleString('id-ID')}
                        </span>
                        {basePrice > 0 && (
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                              basePrice >= estimatedBundleHpp
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            <TrendingUp className="w-3 h-3" />
                            Margin: Rp {(basePrice - estimatedBundleHpp).toLocaleString('id-ID')} (
                            {(((basePrice - estimatedBundleHpp) / basePrice) * 100).toFixed(1)}%)
                          </span>
                        )}
                      </div>
                    </div>

                    {estimatedBundleHpp > 0 && costPrice !== estimatedBundleHpp && (
                      <button
                        type="button"
                        onClick={() => setCostPrice(estimatedBundleHpp)}
                        className="px-3 py-1.5 bg-amber-800 hover:bg-amber-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Sinkronkan ke HPP Produk</span>
                      </button>
                    )}
                  </div>

                  {basePrice > 0 && basePrice < estimatedBundleHpp && (
                    <div className="flex items-center gap-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-xl">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>
                        <strong>Peringatan Margin Negatif:</strong> Harga jual paket (Rp {Number(basePrice).toLocaleString('id-ID')}) lebih rendah dari total modal komponen (Rp {estimatedBundleHpp.toLocaleString('id-ID')}).
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Panel Struktur Harga Grosir Bertingkat (Tiered Volume Pricing) */}
      <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowPriceTiers(!showPriceTiers)}>
          <div>
            <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
              <Tag className="w-4 h-4 text-cyan-700" />
              Harga Grosir Bertingkat (Tiered Pricing)
            </span>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Berikan harga khusus otomatis saat kasir memasukkan jumlah pembelian tertentu (misal: beli $\ge$ 5 paket harga lebih murah).
            </p>
          </div>
          <div className="flex items-center gap-2">
            {priceTiers.length > 0 && (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-900 border border-cyan-200">
                {priceTiers.length} Tier Aktif
              </span>
            )}
            <button
              type="button"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showPriceTiers ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {showPriceTiers && (
          <div className="pt-2.5 border-t border-slate-200/70 space-y-3">
            <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 block">
                + Tambah Tingkat Harga Grosir Baru
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-4">
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                    Minimal Beli (Unit)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={newTierMinQty}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewTierMinQty(val === '' ? '' : Math.max(0, parseInt(val, 10) || 0));
                    }}
                    placeholder="e.g. 5"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-900"
                  />
                  {newTierMinQty !== '' && Number(newTierMinQty) < 2 && (
                    <span className="text-[10px] text-amber-600 block mt-1">
                      Minimal 2 unit untuk harga grosir
                    </span>
                  )}
                </div>
                <div className="sm:col-span-6">
                  <CurrencyInput
                    id="new-tier-price"
                    label="Harga Satuan Grosir"
                    value={newTierPrice}
                    onChange={(val) => setNewTierPrice(val)}
                    placeholder="0"
                    inputClassName="font-bold text-cyan-950 text-xs py-2"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={handleAddPriceTier}
                    className="w-full py-2 bg-cyan-800 hover:bg-cyan-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    Tambah
                  </button>
                </div>
              </div>
            </div>

            {priceTiers.length === 0 ? (
              <div className="p-3 bg-white rounded-xl border-2 border-dashed border-slate-200 text-center text-xs text-slate-400">
                Belum ada struktur harga grosir. Tambahkan tier kuantitas di atas jika produk ini mendukung pembelian grosir.
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                <div className="px-3 py-2 bg-slate-100/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider grid grid-cols-12 gap-2">
                  <div className="col-span-4">Minimal Beli</div>
                  <div className="col-span-4 text-right">Harga Grosir / Pcs</div>
                  <div className="col-span-3 text-right">Hemat / Pcs</div>
                  <div className="col-span-1 text-center">Aksi</div>
                </div>
                {priceTiers.map((pt) => {
                  const savings = basePrice > 0 ? Math.max(0, basePrice - pt.tierPrice) : 0;
                  return (
                    <div key={pt.minQuantity} className="px-3 py-2 text-xs grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-4 font-bold text-slate-900 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
                        <span>Beli &ge; {pt.minQuantity} {unit}</span>
                      </div>
                      <div className="col-span-4 text-right font-bold font-mono text-cyan-900">
                        Rp {pt.tierPrice.toLocaleString('id-ID')}
                      </div>
                      <div className="col-span-3 text-right font-mono text-[11px] text-emerald-700 font-bold">
                        {savings > 0 ? `-Rp ${savings.toLocaleString('id-ID')}` : '-'}
                      </div>
                      <div className="col-span-1 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemovePriceTier(pt.minQuantity)}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-lg transition-colors cursor-pointer"
                          title="Hapus tingkat grosir"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
