import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, ArrowRight, X, Sparkles } from 'lucide-react';

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
    sectionId: 'receipt',
    title: 'Panduan Format Struk Kasir',
    subtitle: 'Pengaturan printer thermal 58/80mm & nomor antrean.',
  },
  settings_channels: {
    sectionId: 'channels',
    title: 'Panduan Kanal Penjualan',
    subtitle: 'Atur mark-up harga mitra online GoFood/Grab/Shopee.',
  },
  settings_payment: {
    sectionId: 'pos',
    title: 'Panduan Metode Pembayaran',
    subtitle: 'Aktivasi QRIS, EDC Bank, dan pembayaran tunai kasir.',
  },
  settings_loyalty: {
    sectionId: 'pos',
    title: 'Panduan Loyalitas & Poin',
    subtitle: 'Konfigurasi member CRM dan diskon pelanggan.',
  },
  outlets: {
    sectionId: 'onboarding',
    title: 'Panduan Kelola Outlet & Cabang',
    subtitle: 'Setup multi cabang toko dan penetapan mode gudang.',
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
    sectionId: 'staff_roles',
    title: 'Panduan Kelola Staf & PIN',
    subtitle: 'Pemberian hak akses kasir/gudang dan reset PIN.',
  },
  staff_roles: {
    sectionId: 'staff_roles',
    title: 'Panduan Hierarki Peran',
    subtitle: 'Perbedaan wewenang Owner, Admin, SPV, Kasir, Gudang.',
  },
  users: {
    sectionId: 'staff_roles',
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
    <div ref={containerRef} className="fixed bottom-14 md:bottom-6 right-4 z-40">
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
                <span>Buka Seluruh Panduan (12 Modul)</span>
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
        className="px-3 py-2 sm:px-3.5 sm:py-2.5 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 hover:from-blue-800 hover:to-indigo-900 text-white font-extrabold text-xs shadow-xl shadow-blue-950/30 flex items-center gap-2 border border-blue-400/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
        title="Buka Pusat Panduan & Bantuan"
      >
        <BookOpen className="w-4 h-4 text-amber-300" />
        <span className="hidden sm:inline">Panduan Sistem</span>
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
      </button>
    </div>
  );
};
