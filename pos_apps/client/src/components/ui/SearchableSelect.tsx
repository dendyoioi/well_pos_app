import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';

export interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
}

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  accentColor?: 'blue' | 'amber';
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '-- Pilih --',
  searchPlaceholder = 'Ketik untuk mencari...',
  emptyMessage = 'Tidak ada pilihan yang cocok',
  className = '',
  disabled = false,
  allowEmpty = true,
  emptyLabel = '-- Tanpa Efek Bahan Baku --',
  accentColor = 'amber',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cari label terpilih
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value);
  }, [options, value]);

  // Filter opsi berdasarkan pencarian
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  // Tutup dropdown saat klik di luar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Fokuskan input pencarian saat dropdown dibuka
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Tangani tombol keyboard Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  const ringStyles =
    accentColor === 'amber'
      ? 'focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500'
      : 'focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Tombol Pemicu Dropdown */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-50/80 hover:bg-white border rounded-lg text-xs transition-all text-left cursor-pointer disabled:opacity-50 disabled:pointer-events-none ${
          isOpen
            ? accentColor === 'amber'
              ? 'border-amber-500 bg-white ring-2 ring-amber-500/20'
              : 'border-blue-900 bg-white ring-2 ring-blue-900/10'
            : 'border-slate-300 hover:border-slate-400'
        } ${ringStyles}`}
      >
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {selectedOption ? (
            <span className="font-semibold text-slate-900 truncate">
              {selectedOption.label}
              {selectedOption.sublabel && (
                <span className="text-slate-400 font-normal ml-1 text-[11px]">
                  ({selectedOption.sublabel})
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-500 font-medium truncate">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-slate-600' : ''
            }`}
          />
        </div>
      </button>

      {/* Popover Menu Dropdown dengan Pencarian */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/80 overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col min-w-[260px]">
          {/* Kolom Pencarian */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/50">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-900/20 focus:border-blue-900"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Daftar Opsi Pilihan */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-50 p-1 overscroll-contain">
            {allowEmpty && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={`w-full flex items-center justify-between px-2.5 py-2 text-xs rounded-lg transition-colors cursor-pointer text-left ${
                  !value
                    ? 'bg-slate-100 text-slate-800 font-bold'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                <span className="italic">{emptyLabel}</span>
                {!value && <Check className="w-3.5 h-3.5 text-slate-600 shrink-0 ml-2" />}
              </button>
            )}

            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400 px-3">
                {emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-xs rounded-lg transition-colors cursor-pointer text-left ${
                      isSelected
                        ? 'bg-blue-50 text-blue-950 font-bold'
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">
                        {opt.label}
                      </div>
                      {opt.sublabel && (
                        <div className="text-[11px] text-slate-400 truncate">
                          {opt.sublabel}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {opt.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200/80">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-blue-900" />
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
