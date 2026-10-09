import React from 'react';
import { Search, X } from 'lucide-react';

export interface ActionBarProps {
  /** Nilai teks pencarian */
  searchTerm?: string;
  /** Handler saat teks pencarian berubah */
  onSearchChange?: (val: string) => void;
  /** Placeholder input pencarian */
  searchPlaceholder?: string;
  /** Tombol atau grup aksi utama (Primary Action, e.g. + Tambah Produk) */
  primaryAction?: React.ReactNode;
  /** Tombol atau dropdown alat sekunder (Secondary Tools, e.g. Alat & Pengaturan v) */
  secondaryAction?: React.ReactNode;
  /** Kontrol tambahan di baris aksi */
  children?: React.ReactNode;
  /** Kustom kelas container */
  className?: string;
}

/**
 * Komponen Toolbar Kanonikal (Option B Pattern):
 * - Desktop (>= 640px): Search bar di kiri (100% fleksibel), Action buttons rapi sejajar di kanan.
 * - Mobile (< 640px): Baris 1 Search Bar penuh (100%), Baris 2 Secondary Tools + Primary Action berdampingan.
 */
export const ActionBar: React.FC<ActionBarProps> = ({
  searchTerm,
  onSearchChange,
  searchPlaceholder = 'Cari data...',
  primaryAction,
  secondaryAction,
  children,
  className = '',
}) => {
  return (
    <div
      className={`bg-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 ${className}`}
    >
      {/* Baris 1 (Mobile) / Sisi Kiri (Desktop): Clean Search Bar 100% */}
      {onSearchChange && (
        <div className="relative flex-1 min-w-0 w-full sm:w-auto">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm || ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full h-10 bg-slate-50 border border-slate-300 focus:border-blue-900 focus:ring-2 focus:ring-blue-900/10 rounded-xl pl-10 pr-9 text-xs sm:text-sm text-slate-800 placeholder-slate-400 transition-all outline-none"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer rounded-full hover:bg-slate-200/50 transition-colors"
              title="Hapus pencarian"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Baris 2 (Mobile) / Sisi Kanan (Desktop): Secondary Tools & Primary Action */}
      {(secondaryAction || primaryAction || children) && (
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end shrink-0">
          {secondaryAction && <div className="flex-1 sm:flex-initial">{secondaryAction}</div>}
          {children && <div className="shrink-0">{children}</div>}
          {primaryAction && <div className="flex-1 sm:flex-initial">{primaryAction}</div>}
        </div>
      )}
    </div>
  );
};
