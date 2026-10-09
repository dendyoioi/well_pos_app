import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Search, LayoutGrid, List, Barcode, X, Camera, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import type { Category, Product } from '../../types/product';

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
  products?: Product[];
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
  products = [],
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = scrollContainerRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkScroll, { passive: true });
    window.addEventListener('resize', checkScroll);
    return () => {
      el.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [checkScroll, categories]);

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -240, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 240, behavior: 'smooth' });
    }
  };

  // Product counts
  const totalProductsCount = products.length;
  const getCategoryCount = (catId: string) => {
    return products.filter((p) => p.category?.id === catId).length;
  };

  const isFilterActive = searchQuery.trim().length > 0 || selectedCategory !== 'all';
  const selectedCategoryObj = categories.find((c) => c.id === selectedCategory);

  return (
    <div className="space-y-2.5 shrink-0">
      {/* 1. Baris Pencarian, Tombol Kamera Barcode & Tampilan Grid/List */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 flex items-center gap-1.5 pointer-events-none">
            <Search className="w-4 h-4 text-slate-400" />
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
            className="w-full h-10 bg-white border border-slate-300 rounded-xl pl-9 sm:pl-16 pr-8 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-900 focus:ring-4 focus:ring-blue-100 shadow-2xs transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              title="Bersihkan pencarian"
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
            className="h-10 px-3 sm:px-3.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200/90 shadow-2xs transition-all flex items-center gap-1.5 text-xs font-extrabold shrink-0 cursor-pointer active:scale-95"
            title="Buka Pemindai Barcode Kamera HP / Webcam"
            aria-label="Scan Barcode via Kamera"
          >
            <Camera className="w-4 h-4 text-blue-900" />
            <span className="hidden sm:inline">Scan Kamera</span>
          </button>
        )}

        {/* View Mode Toggle */}
        <div className="h-10 flex items-center p-1 bg-white border border-slate-200 rounded-xl shadow-2xs shrink-0">
          <button
            type="button"
            onClick={() => onToggleViewMode('grid')}
            className={`h-8 px-2 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
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
            className={`h-8 px-2 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
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

      {/* Barcode Scanner / Order Notification Banner */}
      {scanMessage && (
        <div className="px-3.5 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between animate-fade-in-up">
          <span className="truncate pr-2">{scanMessage}</span>
          {onClearScanMessage && (
            <button
              type="button"
              onClick={onClearScanMessage}
              className="text-emerald-600 hover:text-emerald-900 p-0.5 rounded-md hover:bg-emerald-100 transition-colors shrink-0 cursor-pointer"
              title="Tutup notifikasi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* 2. Full-Width Horizontal Category Carousel Slider */}
      <div className="relative w-full">
        {/* Tombol Geser Kiri */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pr-4 bg-gradient-to-r from-slate-50 via-slate-50/80 to-transparent pointer-events-none">
            <button
              type="button"
              onClick={scrollLeft}
              className="w-7 h-7 rounded-full bg-white shadow-md border border-slate-200 text-slate-700 hover:text-blue-900 hover:bg-blue-50 flex items-center justify-center transition-all cursor-pointer pointer-events-auto active:scale-95"
              aria-label="Geser Kategori ke Kiri"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Category Carousel Container */}
        <div
          ref={scrollContainerRef}
          className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none scroll-smooth w-full"
        >
          {/* Pill Semua Menu */}
          <button
            type="button"
            onClick={() => onSelectCategory('all')}
            className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-blue-900 text-white shadow-xs shadow-blue-900/20'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/90 hover:text-slate-900'
            }`}
          >
            <span>Semua Menu</span>
            {totalProductsCount > 0 && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                  selectedCategory === 'all'
                    ? 'bg-blue-800 text-blue-100'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {totalProductsCount}
              </span>
            )}
          </button>

          {/* List Pill Kategori Menu */}
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            const count = getCategoryCount(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className={`h-9 px-3.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-blue-900 text-white shadow-xs shadow-blue-900/20'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/90 hover:text-slate-900'
                }`}
              >
                <span>{cat.name}</span>
                {count > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
                      isSelected
                        ? 'bg-blue-800 text-blue-100'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tombol Geser Kanan */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 z-10 flex items-center pl-4 bg-gradient-to-l from-slate-50 via-slate-50/80 to-transparent pointer-events-none">
            <button
              type="button"
              onClick={scrollRight}
              className="w-7 h-7 rounded-full bg-white shadow-md border border-slate-200 text-slate-700 hover:text-blue-900 hover:bg-blue-50 flex items-center justify-center transition-all cursor-pointer pointer-events-auto active:scale-95"
              aria-label="Geser Kategori ke Kanan"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 3. Baris Ringkasan Filter & Pencarian Aktif */}
      {isFilterActive && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <Filter className="w-3.5 h-3.5 text-blue-900 shrink-0" />
            <span className="text-[11px] text-slate-500 font-medium">Filter Aktif:</span>

            {searchQuery.trim() && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-blue-200 text-blue-900 font-bold text-[11px]">
                <span>"{searchQuery.trim()}"</span>
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="hover:text-rose-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {selectedCategory !== 'all' && selectedCategoryObj && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-blue-200 text-blue-900 font-bold text-[11px]">
                <span>Kategori: {selectedCategoryObj.name}</span>
                <button
                  type="button"
                  onClick={() => onSelectCategory('all')}
                  className="hover:text-rose-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              onSelectCategory('all');
            }}
            className="text-[11px] font-bold text-blue-900 hover:text-blue-950 underline shrink-0 cursor-pointer"
          >
            Reset Filter
          </button>
        </div>
      )}
    </div>
  );
};
