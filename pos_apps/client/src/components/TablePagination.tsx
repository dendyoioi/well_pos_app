import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface TablePaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  itemLabel?: string;
  className?: string;
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  itemLabel = 'item',
  className = '',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endIndex = Math.min(safeCurrentPage * pageSize, totalItems);

  // Helper untuk menentukan nomor halaman mana yang ditampilkan
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const pages: (number | 'dots-left' | 'dots-right')[] = [];
    pages.push(1);

    if (safeCurrentPage > 3) {
      pages.push('dots-left');
    }

    const start = Math.max(2, safeCurrentPage - 1);
    const end = Math.min(totalPages - 1, safeCurrentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (safeCurrentPage < totalPages - 2) {
      pages.push('dots-right');
    }

    pages.push(totalPages);
    return pages;
  };

  return (
    <div
      className={`px-3 sm:px-5 py-3 sm:py-3.5 bg-slate-50/90 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-3 ${className}`}
    >
      {/* Kontrol Jumlah Baris & Info Rentang Data */}
      <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-3 text-xs text-slate-600 font-semibold w-full sm:w-auto">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="text-slate-500 font-medium text-[11px] sm:text-xs">Baris:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1);
            }}
            className="bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-2 py-1 sm:px-2.5 sm:py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-900/20 cursor-pointer shadow-2xs hover:border-slate-300 transition-all"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <span className="text-slate-300 hidden sm:inline">|</span>

        <span className="text-slate-500 text-[11px] sm:text-xs text-right sm:text-left">
          <span className="hidden sm:inline">Menampilkan </span>
          <strong className="text-slate-900 font-bold">{startIndex}</strong>-
          <strong className="text-slate-900 font-bold">{endIndex}</strong> dari{' '}
          <strong className="text-blue-900 font-extrabold">{totalItems}</strong> {itemLabel}
        </span>
      </div>

      {/* Kontrol Navigasi Halaman */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between sm:justify-end gap-1.5 w-full sm:w-auto">
          {/* Tombol Sebelumnya */}
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))}
            disabled={safeCurrentPage <= 1}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 min-h-[36px]"
            title="Halaman Sebelumnya"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Sebelumnya</span>
          </button>

          {/* Indikator Halaman Mobile (Ringkas, Zero-Overflow) */}
          <div className="flex sm:hidden items-center px-2 text-xs font-bold text-slate-700">
            <span>Hal {safeCurrentPage} / {totalPages}</span>
          </div>

          {/* Nomor Halaman Desktop / Tablet */}
          <div className="hidden sm:flex items-center gap-1">
            {getPageNumbers().map((p, idx) => {
              if (p === 'dots-left' || p === 'dots-right') {
                return (
                  <span key={`${p}-${idx}`} className="px-1 text-slate-400 font-bold text-xs select-none">
                    ...
                  </span>
                );
              }

              const isActive = p === safeCurrentPage;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={`min-w-8 h-8 px-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center active:scale-95 ${
                    isActive
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {p}
                </button>
              );
            })}
          </div>

          {/* Tombol Selanjutnya */}
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))}
            disabled={safeCurrentPage >= totalPages}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-white disabled:cursor-not-allowed text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95 min-h-[36px]"
            title="Halaman Selanjutnya"
          >
            <span className="hidden sm:inline">Selanjutnya</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
