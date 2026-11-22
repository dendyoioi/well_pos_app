import React, { useRef, useState, useEffect } from 'react';
import { Plus, X, Search, ChevronDown, Check, Sparkles } from 'lucide-react';
import type { Category } from '../../types/product';
import { CurrencyInput } from '../ui/CurrencyInput';

interface ProductBasicInfoTabProps {
  name: string;
  setName: (val: string) => void;
  categoryId: string;
  setCategoryId: (val: string) => void;
  categoryList: Category[];
  showQuickCategory: boolean;
  setShowQuickCategory: (val: boolean) => void;
  newCategoryName: string;
  setNewCategoryName: (val: string) => void;
  handleCreateCategory: () => void;
  handleCreateCategoryFromSearch: (name: string) => void;
  unit: string;
  setUnit: (val: string) => void;
  unitList: string[];
  handleAddCustomUnit: (val: string) => void;
  barcode: string;
  setBarcode: (val: string) => void;
  generateRandomBarcode: () => void;
  sku: string;
  setSku: (val: string) => void;
  generateAutoSku: () => void;
  costPrice: number;
  setCostPrice: (val: number) => void;
  basePrice: number;
  setBasePrice: (val: number) => void;
  productMode: 'STANDARD' | 'FNB' | 'COMPOSITE';
  isEdit: boolean;
  initialStock: number;
  setInitialStock: (val: number) => void;
  editPhysicalStock: number;
  setEditPhysicalStock: (val: number) => void;
  minStockAlert: number;
  setMinStockAlert: (val: number) => void;
  description: string;
  setDescription: (val: string) => void;
  isLaundryMode?: boolean;
}

export const ProductBasicInfoTab: React.FC<ProductBasicInfoTabProps> = ({
  name,
  setName,
  categoryId,
  setCategoryId,
  categoryList,
  showQuickCategory,
  setShowQuickCategory,
  newCategoryName,
  setNewCategoryName,
  handleCreateCategory,
  handleCreateCategoryFromSearch,
  unit,
  setUnit,
  unitList,
  handleAddCustomUnit,
  barcode,
  setBarcode,
  generateRandomBarcode,
  sku,
  setSku,
  generateAutoSku,
  costPrice,
  setCostPrice,
  basePrice,
  setBasePrice,
  productMode,
  isEdit,
  initialStock,
  setInitialStock,
  editPhysicalStock,
  setEditPhysicalStock,
  minStockAlert,
  setMinStockAlert,
  description,
  setDescription,
  isLaundryMode = false,
}) => {
  const [categorySearch, setCategorySearch] = useState('');
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false);
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  const [unitSearch, setUnitSearch] = useState('');
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const unitDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (unitDropdownRef.current && !unitDropdownRef.current.contains(event.target as Node)) {
        setIsUnitDropdownOpen(false);
      }
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setIsCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="space-y-4 text-slate-800">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Nama Produk */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Nama Produk *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isLaundryMode ? "misal: Parfum Laundry Sakura 250ml / Hanger Jas" : "misal: Kopi Susu Aren Spesial"}
            className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all outline-none"
          />
        </div>

        {/* Kategori dengan shortcut Tambah Cepat dan Pencarian */}
        <div className="relative" ref={categoryDropdownRef}>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-slate-700">
              Kategori *
            </label>
            <button
              type="button"
              onClick={() => setShowQuickCategory(!showQuickCategory)}
              className="text-[11px] font-bold text-blue-900 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Kategori Baru
            </button>
          </div>

          {showQuickCategory ? (
            <div className="flex items-center gap-1.5 mb-2 p-2 bg-blue-50/60 border border-blue-200 rounded-xl">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Nama kategori baru..."
                className="flex-1 bg-white border border-blue-300 text-xs px-2.5 py-1.5 rounded-lg outline-none"
              />
              <button
                type="button"
                onClick={handleCreateCategory}
                className="px-2.5 py-1.5 bg-blue-900 text-white text-xs font-bold rounded-lg shadow-sm cursor-pointer"
              >
                Simpan
              </button>
              <button
                type="button"
                onClick={() => setShowQuickCategory(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : null}

          <button
            type="button"
            id="product-category-btn"
            onClick={() => {
              setIsCategoryDropdownOpen(!isCategoryDropdownOpen);
              setIsUnitDropdownOpen(false);
            }}
            className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all outline-none flex items-center justify-between text-left cursor-pointer shadow-xs"
          >
            <span className="truncate font-medium text-slate-800">
              {categoryList.find((c) => c.id === categoryId)?.name || '-- Pilih Kategori --'}
            </span>
            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </button>

          {isCategoryDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 space-y-1.5 animate-fadeIn">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="Ketik untuk mencari kategori..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-900 focus:bg-white"
                />
              </div>

              <div className="max-h-44 overflow-y-auto space-y-0.5">
                {categoryList
                  .filter((c) => c.name.toLowerCase().includes(categorySearch.toLowerCase()))
                  .map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCategoryId(c.id);
                        setIsCategoryDropdownOpen(false);
                        setCategorySearch('');
                      }}
                      className={`w-full px-3 py-2 text-xs rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                        c.id === categoryId
                          ? 'bg-blue-900 text-white font-bold shadow-xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{c.name}</span>
                      {c.id === categoryId && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}

                {categoryList.filter((c) =>
                  c.name.toLowerCase().includes(categorySearch.toLowerCase())
                ).length === 0 && (
                  <div className="p-3 text-center text-xs text-slate-400">
                    Kategori "{categorySearch}" tidak ditemukan
                  </div>
                )}
              </div>

              {categorySearch.trim() &&
                !categoryList.some(
                  (c) => c.name.toLowerCase() === categorySearch.trim().toLowerCase()
                ) && (
                  <div className="pt-1.5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleCreateCategoryFromSearch(categorySearch)}
                      className="w-full px-3 py-2 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Buat kategori "{categorySearch.trim()}"</span>
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Satuan Unit dengan Pencarian dan Tambah Mandiri */}
        <div className="relative" ref={unitDropdownRef}>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-slate-700">
              Satuan Unit *
            </label>
            <span className="text-[10px] text-slate-400">Bisa cari & tambah</span>
          </div>

          <button
            type="button"
            id="product-unit-btn"
            onClick={() => {
              setIsUnitDropdownOpen(!isUnitDropdownOpen);
              setIsCategoryDropdownOpen(false);
            }}
            className="w-full bg-white border border-slate-300 hover:border-slate-400 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm transition-all outline-none flex items-center justify-between text-left cursor-pointer shadow-xs"
          >
            <span className="font-semibold text-slate-800">{unit}</span>
            <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
          </button>

          {isUnitDropdownOpen && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 space-y-1.5 animate-fadeIn">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={unitSearch}
                  onChange={(e) => setUnitSearch(e.target.value)}
                  placeholder="Cari atau ketik satuan baru..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-blue-900 focus:bg-white"
                />
              </div>

              <div className="max-h-44 overflow-y-auto space-y-0.5">
                {unitList
                  .filter((u) => u.toLowerCase().includes(unitSearch.toLowerCase()))
                  .map((uItem) => (
                    <button
                      key={uItem}
                      type="button"
                      onClick={() => {
                        setUnit(uItem);
                        setIsUnitDropdownOpen(false);
                        setUnitSearch('');
                      }}
                      className={`w-full px-3 py-1.5 text-xs rounded-xl flex items-center justify-between text-left transition-colors cursor-pointer ${
                        uItem === unit
                          ? 'bg-blue-900 text-white font-bold shadow-xs'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span>{uItem}</span>
                      {uItem === unit && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}

                {unitList.filter((u) =>
                  u.toLowerCase().includes(unitSearch.toLowerCase())
                ).length === 0 && (
                  <div className="p-3 text-center text-xs text-slate-400">
                    Satuan "{unitSearch}" belum ada
                  </div>
                )}
              </div>

              {unitSearch.trim() &&
                !unitList.some(
                  (u) => u.toLowerCase() === unitSearch.trim().toLowerCase()
                ) && (
                  <div className="pt-1.5 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleAddCustomUnit(unitSearch)}
                      className="w-full px-3 py-2 text-xs font-bold text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Gunakan "{unitSearch.trim()}" sebagai satuan baru</span>
                    </button>
                  </div>
                )}
            </div>
          )}
        </div>

        {/* Barcode EAN */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-slate-700">
              Barcode (EAN-13) *
            </label>
            <button
              type="button"
              onClick={generateRandomBarcode}
              className="text-[11px] font-semibold text-blue-900 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3" /> Auto
            </button>
          </div>
          <input
            type="text"
            required
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="misal: 8991234567809"
            className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm font-mono transition-all outline-none"
          />
        </div>

        {/* SKU */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-slate-700">
              Kode SKU *
            </label>
            <button
              type="button"
              onClick={generateAutoSku}
              className="text-[11px] font-semibold text-blue-900 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3" /> Auto
            </button>
          </div>
          <input
            type="text"
            required
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder={isLaundryMode ? "misal: LND-001" : "misal: DRK-001"}
            className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2.5 text-sm font-mono transition-all outline-none"
          />
        </div>

        {/* Harga Modal (HPP) - Auto-Format Rupiah */}
        <div>
          <CurrencyInput
            id="product-cost-price"
            label="Harga Modal (HPP)"
            required
            value={costPrice}
            onChange={(val) => setCostPrice(val)}
            placeholder="0"
            inputClassName="font-semibold text-slate-900"
          />
        </div>

        {/* Harga Jual (HPJ) - Auto-Format Rupiah */}
        <div>
          <CurrencyInput
            id="product-base-price"
            label="Harga Jual Standar"
            required
            value={basePrice}
            onChange={(val) => setBasePrice(val)}
            placeholder="0"
            inputClassName="font-bold text-blue-950"
          />
        </div>
      </div>

      {/* Saldo Stok Fisik jika mode Standar Ritel */}
      {productMode === 'STANDARD' && (
        <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!isEdit ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Stok Awal Fisik (Opsional)
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Bisa 0</span>
                </div>
                <input
                  type="number"
                  min={0}
                  value={initialStock === 0 ? '' : initialStock}
                  placeholder="0 (Bisa diisi nanti via Stok Masuk)"
                  onChange={(e) => setInitialStock(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                  className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2 text-sm transition-all outline-none"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Biarkan kosong/0 jika stok akan dimasukkan nanti lewat menu Stok Masuk (PO Gudang) atau Transfer Toko.
                </p>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    Saldo Stok Fisik Toko Saat Ini
                  </label>
                  <span className="text-[10px] text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                    Ritel Fisik
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  value={editPhysicalStock}
                  onChange={(e) => setEditPhysicalStock(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                  className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2 text-sm transition-all outline-none font-bold text-blue-950"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Kuantitas fisik riil di toko.
                </p>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Batas Minimum Notifikasi Stok Menipis
              </label>
              <input
                type="number"
                min={0}
                value={minStockAlert}
                onChange={(e) => setMinStockAlert(Number(e.target.value))}
                className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2 text-sm transition-all outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {/* Deskripsi Produk */}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1">
          Deskripsi Produk / Catatan (Opsional)
        </label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tuliskan catatan khusus atau deskripsi ringkas..."
          className="w-full bg-white border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 text-slate-900 rounded-xl px-3.5 py-2 text-xs transition-all outline-none resize-none"
        />
      </div>
    </div>
  );
};
