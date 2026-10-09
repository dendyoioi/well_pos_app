import React, { useState, useRef, useEffect } from 'react';
import {
  BookOpen,
  ArrowRight,
  X,
  Sparkles,
  Printer,
  MessageCircle,
  Smartphone,
  Utensils,
  Tag,
  CreditCard,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface FloatingGuideWidgetProps {
  activeTab: string;
  onOpenGuide: (sectionId?: string) => void;
}

const TAB_CONTEXT_MAP: Record<
  string,
  { sectionId: string; title: string; subtitle: string }
> = {
  settings_taxes: {
    sectionId: 'taxes',
    title: 'Panduan Pajak PB1 & Biaya',
    subtitle: 'Cara mengatur tarif PB1 10%, service fee, dan packaging fee.',
  },
  settings_receipt: {
    sectionId: 'bluetooth_printer',
    title: 'Panduan Struk, Printer & WA',
    subtitle: 'Koneksi printer Bluetooth 58/80mm & otomatisasi resi WA.',
  },
  settings_channels: {
    sectionId: 'channels',
    title: 'Panduan Kanal Penjualan',
    subtitle: 'Atur mark-up harga mitra online GoFood/Grab/Shopee.',
  },
  settings_payment: {
    sectionId: 'payment_methods',
    title: 'Panduan Metode Pembayaran',
    subtitle: 'Aktivasi QRIS, EDC Bank, dan pembayaran tunai kasir.',
  },
  settings_loyalty: {
    sectionId: 'pos',
    title: 'Panduan Loyalitas & Poin',
    subtitle: 'Konfigurasi member CRM dan diskon pelanggan.',
  },
  customers: {
    sectionId: 'customer_debt_cashflow',
    title: 'Panduan Kasbon CRM & Piutang',
    subtitle: 'Catat bayar nanti, batas limit piutang, dan arus kas riil.',
  },
  reports: {
    sectionId: 'customer_debt_cashflow',
    title: 'Panduan Laporan & Arus Kas',
    subtitle: 'Laba rugi, audit penjualan, dan laporan arus kas riil.',
  },
  product_analytics: {
    sectionId: 'reports',
    title: 'Panduan Analisis Produk & Menu',
    subtitle: 'Klasifikasi menu terlaris dan analisis margin laba.',
  },
  outlets: {
    sectionId: 'onboarding',
    title: 'Panduan Kelola Toko & Outlet',
    subtitle: 'Setup multi outlet toko dan penetapan mode gudang.',
  },
  products: {
    sectionId: 'products',
    title: 'Panduan Katalog Menu & Produk',
    subtitle: 'Input produk, harga jual kasir, estimasi HPP, dan impor massal.',
  },
  categories: {
    sectionId: 'products',
    title: 'Panduan Kategori Menu',
    subtitle: 'Tata kategori hirarkis agar kasir cepat memilih item.',
  },
  modifiers: {
    sectionId: 'products',
    title: 'Panduan Topping & Modifier',
    subtitle: 'Atur varian tambahan dan pemotongan stok bahan baku.',
  },
  recipes: {
    sectionId: 'products',
    title: 'Panduan Resep & Formula BOM',
    subtitle: 'Standarisasi porsi dan bahan baku mentah olahan dapur.',
  },
  pos: {
    sectionId: 'pos',
    title: 'Panduan Operasional Kasir (POS)',
    subtitle: 'Langkah transaksi, modifier topping, dan pembayaran.',
  },
  shifts: {
    sectionId: 'shifts',
    title: 'Panduan Shift Kasir (X/Z)',
    subtitle: 'Modal awal uang laci, petty cash, dan audit selisih kas.',
  },
  orders: {
    sectionId: 'void',
    title: 'Panduan Void & Otorisasi PIN',
    subtitle: 'Aturan pembatalan order wajib persetujuan Supervisor.',
  },
  inventory: {
    sectionId: 'transfers',
    title: 'Panduan Stok Bahan Baku',
    subtitle: 'Manajemen persediaan dan toleransi stok dapur.',
  },
  stock_movements: {
    sectionId: 'transfers',
    title: 'Panduan Mutasi Stok',
    subtitle: 'Audit ledger pergerakan barang masuk dan keluar.',
  },
  transfers: {
    sectionId: 'warehouse',
    title: 'Panduan Transfer Gudang-Toko',
    subtitle: 'Alur permintaan, pengiriman, dan konfirmasi barang.',
  },
  purchase_orders: {
    sectionId: 'warehouse',
    title: 'Panduan Pengadaan (PO)',
    subtitle: 'Penerbitan PO vendor dan penerimaan pasokan barang.',
  },
  suppliers: {
    sectionId: 'warehouse',
    title: 'Panduan Pemasok (Vendor)',
    subtitle: 'Data kontak rekanan supplier bahan baku toko.',
  },
  qr_tables: {
    sectionId: 'qr_menu',
    title: 'Panduan Buku Menu QR Meja',
    subtitle: 'Cetak stiker QR code meja untuk pesanan mandiri tamu.',
  },
  qr_settings: {
    sectionId: 'qr_menu',
    title: 'Panduan Pengaturan Menu QR',
    subtitle: 'Branding kafe dan batasan pemesanan meja tamu.',
  },
  qr_orders: {
    sectionId: 'qr_menu',
    title: 'Panduan Pesanan QR Live',
    subtitle: 'Menerima dan memproses order digital meja ke dapur.',
  },
  staff_users: {
    sectionId: 'staff_attendance',
    title: 'Panduan Absensi Staf Mandiri',
    subtitle: 'Pencatatan Clock In/Out, toleransi telat, dan rekap jam kerja.',
  },
  staff_roles: {
    sectionId: 'granular_rbac_roles',
    title: 'Panduan Hak Akses RBAC',
    subtitle: 'Hierarki wewenang Owner, Admin, Supervisor, Kasir, Gudang.',
  },
  users: {
    sectionId: 'granular_rbac_roles',
    title: 'Panduan Akses Pengguna',
    subtitle: 'Keamanan akun dan pemutusan sesi perangkat.',
  },
  overview: {
    sectionId: 'onboarding',
    title: 'Panduan Ringkasan Bisnis',
    subtitle: 'Memahami metrik penjualan dan performa toko Anda.',
  },
};

export const FloatingGuideWidget: React.FC<FloatingGuideWidgetProps> = ({
  activeTab,
  onOpenGuide,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tutup popup saat klik di luar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

  // Jika sedang di halaman guide, widget melayang tidak perlu tampil (dipanggil SETELAH seluruh hook)
  if (activeTab === 'guide') return null;

  const currentContext = TAB_CONTEXT_MAP[activeTab];

  return (
    <div
      ref={containerRef}
      className={`fixed ${
        activeTab === 'pos'
          ? 'bottom-[max(1rem,env(safe-area-inset-bottom,0px))] md:bottom-6'
          : 'bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6'
      } right-3 sm:right-6 z-30 transition-all duration-200`}
    >
      {/* Popover Menu Bantuan */}
      {isOpen && (
        <div className="mb-2 w-72 sm:w-80 bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in text-slate-800">
          {/* Header Popover */}
          <div className="p-3.5 bg-gradient-to-r from-blue-950 to-indigo-950 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-blue-500/20 text-blue-300 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black">Bantuan &amp; Panduan Cepat</h4>
                <p className="text-[10px] text-blue-200/80">SOP Operasional Well POS</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 space-y-2">
            {/* Rekomendasi Kontekstual Halaman Ini */}
            {currentContext ? (
              <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-blue-900">
                  <Sparkles className="w-3.5 h-3.5 text-blue-700" />
                  <span>Panduan Khusus Halaman Ini:</span>
                </div>
                <h5 className="text-xs font-extrabold text-blue-950">
                  {currentContext.title}
                </h5>
                <p className="text-[11px] text-slate-600 leading-tight">
                  {currentContext.subtitle}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenGuide(currentContext.sectionId);
                  }}
                  className="w-full mt-2 py-1.5 px-3 bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <span>Baca Panduan Ini</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : null}

            {/* Topik Populer / Fitur Terbaru Enhancement */}
            <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
                Pintasan Fitur Baru &amp; Hardware:
              </span>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenGuide('barcode_shelf_labels');
                  }}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-950 border border-slate-200/80 text-left font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Tag className="w-3.5 h-3.5 text-blue-800 shrink-0" />
                  <span className="truncate">Label Barcode Rak</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenGuide('customer_debt_cashflow');
                  }}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-950 border border-slate-200/80 text-left font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span className="truncate">Kasbon &amp; CRM</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenGuide('staff_attendance');
                  }}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-950 border border-slate-200/80 text-left font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                  <span className="truncate">Absensi Staf</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenGuide('granular_rbac_roles');
                  }}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-amber-50 hover:text-amber-950 border border-slate-200/80 text-left font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span className="truncate">Hak Akses RBAC</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenGuide('bluetooth_printer');
                  }}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-950 border border-slate-200/80 text-left font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-800 shrink-0" />
                  <span className="truncate">Printer Bluetooth</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenGuide('whatsapp_receipt');
                  }}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-emerald-50 hover:text-emerald-950 border border-slate-200/80 text-left font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span className="truncate">Resi WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenGuide('pwa_install');
                  }}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-indigo-50 hover:text-indigo-950 border border-slate-200/80 text-left font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                  <span className="truncate">App Kasir PWA</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenGuide('open_tab_rules');
                  }}
                  className="p-2 rounded-xl bg-slate-50 hover:bg-amber-50 hover:text-amber-950 border border-slate-200/80 text-left font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Utensils className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                  <span className="truncate">Pesanan Susulan</span>
                </button>
              </div>
            </div>

            {/* Tombol ke Pusat Panduan Lengkap */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenGuide();
              }}
              className="w-full p-2.5 rounded-2xl hover:bg-slate-50 border border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-blue-900" />
                <span>Buka Seluruh Panduan (23 Bab Lengkap)</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="px-2.5 py-2 sm:px-3.5 sm:py-2.5 rounded-full sm:rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 hover:from-blue-800 hover:to-indigo-900 text-white font-extrabold text-xs shadow-lg shadow-blue-950/25 flex items-center gap-1.5 sm:gap-2 border border-blue-400/30 transition-all hover:scale-105 active:scale-95 cursor-pointer backdrop-blur-xs"
        title="Buka Pusat Panduan & Bantuan"
      >
        <BookOpen className="w-4 h-4 text-amber-300" />
        <span className="hidden md:inline">Panduan Sistem</span>
        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-amber-400 animate-pulse" />
      </button>
    </div>
  );
};
