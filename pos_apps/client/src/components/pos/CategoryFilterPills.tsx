import React from 'react';
import { Search, LayoutGrid, List, Barcode, X, Camera } from 'lucide-react';
import type { Category } from '../../types/product';

export interface CategoryFilterPillsProps {
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit?: () => void;
  viewMode: 'grid' | 'compact';
  onToggleViewMode: (mode: 'grid' | 'compact') => void;
  scanMessage?: string | null;
  onClearScanMessage?: () => void;
  onOpenBarcodeScanner?: () => void;
}

export const CategoryFilterPills: React.FC<CategoryFilterPillsProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  viewMode,
  onToggleViewMode,
  scanMessage,
  onClearScanMessage,
  onOpenBarcodeScanner,
}) => {
  return (
    <div className="space-y-3 shrink-0">
      {/* Search Bar & View Mode Toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 flex items-center gap-1.5 pointer-events-none">
            <Search className="w-4 h-4" />
            <Barcode className="w-4 h-4 text-slate-300 hidden sm:block" />
          </div>
          <input
            type="text"
            placeholder="Scan barcode atau cari nama produk/SKU..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && onSearchSubmit) {
                onSearchSubmit();
              }
            }}
            className="w-full bg-white border border-slate-300 rounded-xl pl-9 sm:pl-16 pr-8 py-2 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-900 focus:ring-4 focus:ring-blue-100 shadow-2xs transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Live Camera Scanner Button */}
        {onOpenBarcodeScanner && (
          <button
            type="button"
            onClick={onOpenBarcodeScanner}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200/90 shadow-2xs transition-all flex items-center gap-1.5 text-xs font-extrabold shrink-0 cursor-pointer active:scale-95"
            title="Buka Pemindai Barcode Kamera HP / Webcam"
            aria-label="Scan Barcode via Kamera"
          >
            <Camera className="w-4 h-4 text-blue-900" />
            <span className="hidden sm:inline">Scan Kamera</span>
          </button>
        )}

        {/* View Mode Toggle */}
        <div className="flex items-center p-1 bg-white border border-slate-200 rounded-xl shadow-2xs">
          <button
            type="button"
            onClick={() => onToggleViewMode('grid')}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'grid'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-700'
            }`}
            title="Tampilan Grid Menu"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onToggleViewMode('compact')}
            className={`p-1.5 rounded-lg transition-all ${
              viewMode === 'compact'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-700'
            }`}
            title="Tampilan List Kompak / Retail Barcode"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Barcode scanner / order banner notification */}
      {scanMessage && (
        <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between animate-fade-in-up">
          <span className="truncate pr-2">{scanMessage}</span>
          {onClearScanMessage && (
            <button
              type="button"
              onClick={onClearScanMessage}
              className="text-emerald-600 hover:text-emerald-900 p-0.5 rounded-md hover:bg-emerald-100 transition-colors shrink-0"
              title="Tutup notifikasi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Category Pills Slider */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => onSelectCategory('all')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            selectedCategory === 'all'
              ? 'bg-blue-900 text-white shadow-xs shadow-blue-900/20'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80 hover:text-slate-900'
          }`}
        >
          Semua Menu
        </button>

        {categories.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isSelected
                  ? 'bg-blue-900 text-white shadow-xs shadow-blue-900/20'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80 hover:text-slate-900'
              }`}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};
