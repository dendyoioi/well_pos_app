import React, { useState } from 'react';
import {
  Store,
  ChevronDown,
  ChevronRight,
  HelpCircle,
  Globe,
  Bell,
  Lock,
  LogOut,
  CreditCard,
  LayoutDashboard,
  Zap,
  UtensilsCrossed,
  QrCode,
  Boxes,
  Receipt,
  BarChart3,
  Tag,
  Users,
  Settings,
  Plus,
  Warehouse,
  Package,
  Coins,
  Menu,
  X,
} from 'lucide-react';
import type { User } from '../../types/auth';
import type { Outlet } from '../../types/outlet';
import { useDialog } from '../../context/DialogContext';

interface BackofficeLayoutProps {
  user: User;
  outlets: Outlet[];
  activeOutlet: Outlet | null;
  onSelectOutlet: (outletId: string) => void;
  activeTab: any;
  onTabChange: (tab: any) => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export const BackofficeLayout: React.FC<BackofficeLayoutProps> = ({
  user,
  outlets,
  activeOutlet,
  onSelectOutlet,
  activeTab,
  onTabChange,
  onLogout,
  children,
}) => {
  const dialog = useDialog();
  // Accordion state for sidebar groups (F&B Centric)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    menu_produk: true,
    buku_menu: false,
    stok: false,
    laporan: false,
    promosi: false,
    staf: false,
    pengaturan: false,
  });
  const [storeDropdownOpen, setStoreDropdownOpen] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const toggleGroup = (group: string) => {
    setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const renderNavContent = (onItemClick?: () => void) => {
    const handleSelectTab = (tab: any) => {
      onTabChange(tab);
      onItemClick?.();
    };

    if (activeOutlet?.isWarehouse) {
      return (
        /* MODE KHUSUS GUDANG (LOGISTIK & PASOKAN PUSAT) */
        <div className="space-y-3">
          {/* Banner Status Mode Gudang */}
          <div className="p-3 rounded-2xl bg-indigo-50/90 border border-indigo-200/80 shadow-xs space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-700 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Warehouse className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-wider text-indigo-700">
                  Mode Gudang Aktif
                </div>
                <div className="text-xs font-black text-slate-900 truncate">
                  {activeOutlet.name}
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                const storeOutlets = outlets.filter((o) => !o.isWarehouse);
                if (storeOutlets.length > 0) {
                  onSelectOutlet(storeOutlets[0].id);
                  handleSelectTab('overview');
                }
              }}
              className="w-full py-1.5 px-2.5 rounded-xl bg-white hover:bg-slate-50 border border-indigo-200 text-indigo-950 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <Store className="w-3.5 h-3.5 text-indigo-700" />
              <span>Beralih ke Toko Penjualan</span>
            </button>
          </div>

          {/* 1. Logistik & Persediaan */}
          <div className="space-y-1">
            <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Persediaan &amp; Stok
            </div>
            <button
              onClick={() => handleSelectTab('inventory')}
              className={`w-full text-left px-3 py-2 rounded-xl font-bold flex items-center gap-2.5 transition-all ${
                activeTab === 'inventory'
                  ? 'bg-indigo-900 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-indigo-50/60'
              }`}
            >
              <Boxes className="w-4 h-4 shrink-0" />
              <span>Stok Bahan &amp; Barang</span>
            </button>
            <button
              onClick={() => handleSelectTab('stock_movements')}
              className={`w-full text-left px-3 py-2 rounded-xl font-bold flex items-center gap-2.5 transition-all ${
                activeTab === 'stock_movements'
                  ? 'bg-indigo-900 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-indigo-50/60'
              }`}
            >
              <Receipt className="w-4 h-4 shrink-0" />
              <span>Mutasi &amp; Transfer Toko</span>
            </button>
          </div>

          {/* 2. Pengadaan & Pemasok */}
          <div className="space-y-1 pt-1">
            <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Pengadaan &amp; Vendor
            </div>
            <button
              onClick={() => handleSelectTab('suppliers')}
              className={`w-full text-left px-3 py-2 rounded-xl font-bold flex items-center gap-2.5 transition-all ${
                activeTab === 'suppliers'
                  ? 'bg-indigo-900 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-indigo-50/60'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Pemasok (Suppliers)</span>
            </button>
          </div>

          {/* 3. Resep Formula & Master Bahan */}
          <div className="space-y-1 pt-1">
            <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Formula &amp; Standar
            </div>
            <button
              onClick={() => handleSelectTab('recipes')}
              className={`w-full text-left px-3 py-2 rounded-xl font-bold flex items-center gap-2.5 transition-all ${
                activeTab === 'recipes'
                  ? 'bg-indigo-900 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-indigo-50/60'
              }`}
            >
              <UtensilsCrossed className="w-4 h-4 shrink-0" />
              <span>Formula Resep &amp; BOM</span>
            </button>
            <button
              onClick={() => handleSelectTab('products')}
              className={`w-full text-left px-3 py-2 rounded-xl font-bold flex items-center gap-2.5 transition-all ${
                activeTab === 'products'
                  ? 'bg-indigo-900 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-indigo-50/60'
              }`}
            >
              <Package className="w-4 h-4 shrink-0" />
              <span>Katalog Bahan &amp; Produk</span>
            </button>
          </div>

          {/* 4. Tim Staf & Kelola Toko */}
          <div className="space-y-1 pt-1">
            <div className="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider">
              Manajemen Gudang
            </div>
            <button
              onClick={() => handleSelectTab('staff_users')}
              className={`w-full text-left px-3 py-2 rounded-xl font-bold flex items-center gap-2.5 transition-all ${
                activeTab === 'staff_users' || activeTab === 'users'
                  ? 'bg-indigo-900 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-indigo-50/60'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Tim Staf Gudang</span>
            </button>
            <button
              onClick={() => handleSelectTab('outlets')}
              className={`w-full text-left px-3 py-2 rounded-xl font-bold flex items-center gap-2.5 transition-all ${
                activeTab === 'outlets'
                  ? 'bg-indigo-900 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-indigo-50/60'
              }`}
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span>Kelola Toko &amp; Gudang</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      /* MODE TOKO PENJUALAN (OPERASIONAL KASIR & KAFE LENGKAP) */
      <div className="space-y-1">
        {/* Quick Launch Ringkasan Bisnis */}
        <button
          onClick={() => handleSelectTab('overview')}
          className={`w-full text-left px-3 py-2.5 rounded-xl font-bold flex items-center gap-2.5 transition-all ${
            activeTab === 'overview'
              ? 'bg-blue-900 text-white shadow-xs'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span>Ringkasan Bisnis</span>
        </button>

        {/* Menu Khusus Pemilik: Paket & Kuota Token */}
        {(user.role === 'ADMIN' || user.role === 'OWNER') && (
          <button
            onClick={() => handleSelectTab('billing_tokens')}
            className={`w-full text-left px-3 py-2.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer ${
              activeTab === 'billing_tokens'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2.5">
              <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                activeTab === 'billing_tokens' ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-700'
              }`}>
                <Zap className="w-3.5 h-3.5 fill-current" />
              </span>
              <span>Paket &amp; Kuota</span>
            </span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0 ${
              activeTab === 'billing_tokens'
                ? 'bg-amber-500 text-white'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}>
              <Coins className="w-3 h-3" />
              <span>Token</span>
            </span>
          </button>
        )}

        {/* 1. Group: Menu & Produk F&B */}
        <div className="pt-1">
          <button
            onClick={() => toggleGroup('menu_produk')}
            className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-bold flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <UtensilsCrossed className="w-4 h-4 text-slate-500" />
              <span>Menu &amp; Produk</span>
            </span>
            {openGroups.menu_produk ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {openGroups.menu_produk && (
            <div className="pl-8 pr-2 py-1 space-y-1">
              <button
                onClick={() => handleSelectTab('products')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'products' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daftar Menu
              </button>
              <button
                onClick={() => handleSelectTab('categories')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'categories' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kategori Menu
              </button>
              <button
                onClick={() => handleSelectTab('modifiers')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'modifiers' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Modifier &amp; Topping
              </button>
              <button
                onClick={() => handleSelectTab('recipes')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'recipes' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Resep &amp; Bahan (BOM)
              </button>
            </div>
          )}
        </div>

        {/* 2. Group: Buku Menu QR (Self-Order) */}
        <div className="pt-1">
          <button
            onClick={() => toggleGroup('buku_menu')}
            className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-bold flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-slate-500" />
              <span>Buku Menu QR</span>
            </span>
            {openGroups.buku_menu ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {openGroups.buku_menu && (
            <div className="pl-8 pr-2 py-1 space-y-1">
              <button
                onClick={() => handleSelectTab('qr_tables')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'qr_tables' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daftar Meja &amp; QR
              </button>
              <button
                onClick={() => handleSelectTab('qr_settings')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'qr_settings' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pengaturan Buku Menu
              </button>
              <button
                onClick={() => handleSelectTab('qr_orders')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'qr_orders' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pesanan Mandiri Masuk
              </button>
              <button
                onClick={() => handleSelectTab('qr_guest_menu')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors flex items-center justify-between ${
                  activeTab === 'qr_guest_menu' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>Tampilan Menu Tamu</span>
                <span className="text-[10px] bg-blue-100 text-blue-900 font-extrabold px-1.5 py-0.5 rounded-full">Pratinjau</span>
              </button>
            </div>
          )}
        </div>

        {/* 3. Group: Bahan Baku & Stok */}
        <div className="pt-1">
          <button
            onClick={() => toggleGroup('stok')}
            className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-bold flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-slate-500" />
              <span>Bahan Baku &amp; Stok</span>
            </span>
            {openGroups.stok ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {openGroups.stok && (
            <div className="pl-8 pr-2 py-1 space-y-1">
              <button
                onClick={() => handleSelectTab('inventory')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'inventory' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Stok Bahan Baku
              </button>
              <button
                onClick={() => handleSelectTab('stock_movements')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'stock_movements' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Riwayat Mutasi Stok
              </button>
              <button
                onClick={() => handleSelectTab('suppliers')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'suppliers' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pemasok / Supplier
              </button>
            </div>
          )}
        </div>

        {/* 4. Single: Riwayat Transaksi */}
        <div className="pt-1">
          <button
            onClick={() => handleSelectTab('orders')}
            className={`w-full text-left px-3 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors ${
              activeTab === 'orders' ? 'bg-blue-50 text-blue-900' : 'text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Receipt className="w-4 h-4 text-slate-500" />
            <span>Riwayat Transaksi</span>
          </button>
        </div>

        {/* 5. Group: Laporan & Keuangan */}
        <div className="pt-1">
          <button
            onClick={() => toggleGroup('laporan')}
            className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-bold flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-slate-500" />
              <span>Laporan &amp; Keuangan</span>
            </span>
            {openGroups.laporan ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {openGroups.laporan && (
            <div className="pl-8 pr-2 py-1 space-y-1">
              <button
                onClick={() => handleSelectTab('reports')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'reports' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Laporan Penjualan &amp; Finansial
              </button>
              <button
                onClick={() => handleSelectTab('shifts')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'shifts' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Rekap Shift Kasir (X/Z)
              </button>
              <button
                onClick={() => handleSelectTab('product_analytics')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'product_analytics' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Analisis Menu &amp; HPP
              </button>
            </div>
          )}
        </div>

        {/* 6. Group: Promosi & Diskon */}
        <div className="pt-1">
          <button
            onClick={() => toggleGroup('promosi')}
            className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-bold flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-slate-500" />
              <span>Promosi &amp; Diskon</span>
            </span>
            {openGroups.promosi ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {openGroups.promosi && (
            <div className="pl-8 pr-2 py-1 space-y-1">
              <button
                onClick={() => handleSelectTab('promotions')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'promotions' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Diskon &amp; Voucher
              </button>
            </div>
          )}
        </div>

        {/* 7. Group: Manajemen Staf */}
        <div className="pt-1">
          <button
            onClick={() => toggleGroup('staf')}
            className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-bold flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-500" />
              <span>Manajemen Staf</span>
            </span>
            {openGroups.staf ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {openGroups.staf && (
            <div className="pl-8 pr-2 py-1 space-y-1">
              <button
                onClick={() => handleSelectTab('staff_users')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'staff_users' || activeTab === 'users' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kelola Staf
              </button>
              <button
                onClick={() => handleSelectTab('staff_roles')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'staff_roles' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Akses &amp; Peran
              </button>
            </div>
          )}
        </div>

        {/* 8. Group: Pengaturan Resto & Outlet */}
        <div className="pt-1">
          <button
            onClick={() => toggleGroup('pengaturan')}
            className="w-full text-left px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 font-bold flex items-center justify-between"
          >
            <span className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-slate-500" />
              <span>Pengaturan Resto</span>
            </span>
            {openGroups.pengaturan ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
          {openGroups.pengaturan && (
            <div className="pl-8 pr-2 py-1 space-y-1">
              <button
                onClick={() => handleSelectTab('settings_receipt')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'settings_receipt' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Format Struk Kasir
              </button>
              <button
                onClick={() => handleSelectTab('settings_taxes')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'settings_taxes' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Pajak (PB1) &amp; Biaya Layanan
              </button>
              <button
                onClick={() => handleSelectTab('settings_payment')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'settings_payment' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Metode Pembayaran &amp; QRIS
              </button>
              <button
                onClick={() => handleSelectTab('settings_channels')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'settings_channels' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Kanal Penjualan &amp; Mitra
              </button>
              <button
                onClick={() => handleSelectTab('outlets')}
                className={`w-full text-left py-1.5 px-2 rounded-lg transition-colors ${
                  activeTab === 'outlets' ? 'bg-blue-50 text-blue-900 font-bold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Profil &amp; Outlet Toko
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white overflow-hidden">
      {/* =========================================================================
          TOP HEADER BAR (WELL POS ENTERPRISE MULTI-STORE NAV)
          ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs h-14 sm:h-16 shrink-0 px-3 sm:px-6 flex items-center justify-between">
        {/* Left: Mobile Hamburger & Brand & Store Selector */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          {/* Hamburger Menu Trigger for 6.8" Smartphone Portrait */}
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="md:hidden p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
            title="Buka Menu Navigasi"
            aria-label="Buka Menu Navigasi"
          >
            <Menu className="w-5 h-5 text-slate-700" />
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-blue-950 text-white flex items-center justify-center font-black shadow-md shadow-blue-950/20">
              <Store className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
            </div>
            <span className="text-sm sm:text-base font-black tracking-tight text-blue-950 hidden sm:inline">
              WELL POS
            </span>
          </div>

          <div className="h-5 w-px bg-slate-200 hidden sm:block" />

          {/* Store & Warehouse Dropdown Selector */}
          {(() => {
            const storeOutlets = outlets.filter((o) => !o.isWarehouse);
            const warehouses = outlets.filter((o) => o.isWarehouse);
            const isWarehouseActive = !!activeOutlet?.isWarehouse;

            return (
              <div className="relative">
                <button
                  onClick={() => setStoreDropdownOpen(!storeDropdownOpen)}
                  className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-xs ${
                    isWarehouseActive
                      ? 'border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-950'
                      : 'border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  {isWarehouseActive ? (
                    <Warehouse className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  )}
                  <span className="max-w-[110px] xs:max-w-[140px] sm:max-w-[200px] truncate">
                    {activeOutlet?.name || (storeOutlets[0]?.name ?? 'Pilih Toko')}
                  </span>
                  {isWarehouseActive ? (
                    <span className="text-[10px] bg-indigo-200/80 text-indigo-900 px-1.5 py-0.5 rounded font-black shrink-0">
                      Gudang
                    </span>
                  ) : null}
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                </button>

                {storeDropdownOpen && (
                  <>
                    {/* Backdrop to close when tapping outside */}
                    <div
                      className="fixed inset-0 z-40 bg-black/20 sm:bg-transparent"
                      onClick={() => setStoreDropdownOpen(false)}
                    />
                    <div className="fixed sm:absolute left-3 right-3 sm:left-0 sm:right-auto top-[58px] sm:top-full mt-0 sm:mt-2 w-auto sm:w-80 max-w-[calc(100vw-1.5rem)] sm:max-w-sm max-h-[85vh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-2 text-xs space-y-1 animate-fadeIn">
                      {isWarehouseActive && storeOutlets.length > 0 && (
                        <div className="pb-1.5 mb-1 border-b border-slate-100">
                          <button
                            onClick={() => {
                              onSelectOutlet(storeOutlets[0].id);
                              onTabChange('overview');
                              setStoreDropdownOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-950 font-bold flex items-center justify-between transition-colors"
                          >
                            <span className="flex items-center gap-2 truncate">
                              <Store className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
                              <span className="truncate">Kembali ke Toko Penjualan</span>
                            </span>
                            <span className="text-[10px] text-indigo-700 font-black">↗</span>
                          </button>
                        </div>
                      )}

                      <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Daftar Toko Penjualan</span>
                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-bold">{storeOutlets.length} Toko</span>
                      </div>

                      {storeOutlets.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-400 italic">Belum ada toko terdaftar</div>
                      ) : (
                        storeOutlets.map((outlet) => (
                          <button
                            key={outlet.id}
                            onClick={() => {
                              onSelectOutlet(outlet.id);
                              if (isWarehouseActive) {
                                onTabChange('overview');
                              }
                              setStoreDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between gap-2 font-semibold transition-colors ${
                              activeOutlet?.id === outlet.id
                                ? 'bg-blue-50 text-blue-900 font-bold'
                                : 'text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <span className="truncate">{outlet.name}</span>
                            {activeOutlet?.id === outlet.id && (
                              <span className="text-[10px] bg-blue-900 text-white px-2 py-0.5 rounded-md font-bold shrink-0">
                                Aktif
                              </span>
                            )}
                          </button>
                        ))
                      )}

                      {/* Mode Pusat Logistik & Gudang */}
                      {warehouses.length > 0 && (
                        <div className="pt-1.5 border-t border-slate-100 space-y-1">
                          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Pusat Pasokan &amp; Logistik
                          </div>
                          {warehouses.map((wh) => (
                            <button
                              key={wh.id}
                              onClick={() => {
                                onSelectOutlet(wh.id);
                                onTabChange('inventory');
                                setStoreDropdownOpen(false);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-xl font-semibold flex items-center justify-between gap-2 transition-colors group ${
                                activeOutlet?.id === wh.id
                                  ? 'bg-indigo-100 text-indigo-950 font-bold'
                                  : 'text-slate-700 hover:bg-indigo-50/70'
                              }`}
                              title={`Buka Persediaan ${wh.name}`}
                            >
                              <span className="flex items-center gap-2 truncate min-w-0">
                                <Warehouse className="w-3.5 h-3.5 text-indigo-700 shrink-0 group-hover:scale-110 transition-transform" />
                                <span className="truncate text-slate-800 font-medium">{wh.name}</span>
                              </span>
                              <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded font-bold shrink-0">
                                {activeOutlet?.id === wh.id ? 'Aktif' : 'Buka Gudang'}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Kelola Toko & Pengaturan */}
                      <div className="pt-1.5 border-t border-slate-100">
                        <button
                          onClick={() => {
                            setStoreDropdownOpen(false);
                            onTabChange('outlets');
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl text-blue-900 hover:bg-blue-50 font-bold flex items-center gap-2"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Kelola &amp; Tambah Toko</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </div>

        {/* Right: Help, Lang, Notifications, Plan Badge, Profile & Logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Action Button: Return to Store (if in Warehouse Mode) or Launch POS (if Store Mode) */}
          {activeOutlet?.isWarehouse ? (
            <button
              onClick={() => {
                const storeOutlets = outlets.filter((o) => !o.isWarehouse);
                if (storeOutlets.length > 0) {
                  onSelectOutlet(storeOutlets[0].id);
                  onTabChange('overview');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-900 hover:bg-indigo-950 text-white text-xs font-black shadow-md shadow-indigo-900/20 transition-all active:scale-95"
              title="Beralih ke Toko Penjualan"
            >
              <Store className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kembali ke Toko</span>
            </button>
          ) : activeTab !== 'pos' ? (
            <button
              onClick={() => onTabChange('pos')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition-all active:scale-95"
              title="Buka Mesin Kasir"
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Buka Kasir POS</span>
            </button>
          ) : null}

          {/* Help Icon */}
          <button
            title="Bantuan & Dukungan"
            onClick={() =>
              dialog.alert({
                title: 'Pusat Bantuan Well POS',
                message: (
                  <div className="space-y-2">
                    <p>Butuh bantuan teknis atau operasional sistem?</p>
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-950 text-xs font-semibold space-y-1">
                      <div>📧 Email: support@wellpos.id</div>
                      <div>💬 WhatsApp Hotline: 0812-3456-7890</div>
                    </div>
                  </div>
                ),
                variant: 'info',
              })
            }
            className="hidden sm:flex p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          {/* Language Selector */}
          <div className="hidden sm:flex items-center gap-1 text-xs text-slate-600 px-2 py-1 rounded-lg border border-slate-200">
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold">Indonesia</span>
          </div>

          {/* Notifications */}
          <button
            title="Notifikasi Sistem"
            className="hidden sm:flex p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors relative"
          >
            <Bell className="w-4 h-4" />
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 absolute top-2 right-2" />
          </button>

          {/* Plan & Token Quota Badge */}
          {(user.role === 'ADMIN' || user.role === 'OWNER') && (
            <button
              onClick={() => onTabChange('billing_tokens')}
              title="Kelola Paket & Kuota Token Transaksi"
              className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border transition-all cursor-pointer ${
                activeTab === 'billing_tokens'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
              }`}
            >
              <Zap className={`w-3.5 h-3.5 ${activeTab === 'billing_tokens' ? 'fill-white text-white' : 'fill-amber-500 text-amber-600'}`} />
              <span>Paket &amp; Kuota</span>
            </button>
          )}

          {/* Profile & Avatar */}
          <div className="flex items-center gap-2 pl-1.5 sm:pl-2 border-l border-slate-200">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-900 text-white flex items-center justify-center text-xs font-black shrink-0">
              {user.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="hidden lg:block text-left text-xs">
              <p className="font-bold text-slate-800 leading-tight">{user.name}</p>
              <p className="text-[10px] text-slate-400 font-semibold">{user.role}</p>
            </div>
          </div>

          {/* Lock Screen */}
          <button
            onClick={onLogout}
            title="Kunci Terminal"
            className="p-1.5 sm:p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-all cursor-pointer shrink-0"
          >
            <Lock className="w-4 h-4" />
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            title="Keluar Akun"
            className="p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-slate-200 transition-all text-slate-600 cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* =========================================================================
          BODY LAYOUT: ACCORDION SIDEBAR + MAIN CONTENT + MOBILE DRAWER & BOTTOM BAR
      ========================================================================= */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Desktop Collapsible Accordion Sidebar */}
        <aside className={`w-64 border-r shrink-0 hidden md:flex flex-col justify-between overflow-y-auto p-3 text-xs sticky top-16 h-[calc(100vh-4rem)] scrollbar-thin scrollbar-thumb-slate-200 ${
          activeOutlet?.isWarehouse ? 'bg-slate-50/70 border-indigo-100' : 'bg-white border-slate-200'
        }`}>
          {renderNavContent()}

          {/* Bottom Card / Support Hotline */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-[11px] text-slate-500 space-y-1 mt-4">
            <p className="font-bold text-slate-800">
              {activeOutlet?.isWarehouse ? 'Mode Gudang Logistik' : 'Butuh Bantuan?'}
            </p>
            <p>
              {activeOutlet?.isWarehouse
                ? 'Terhubung langsung dengan alokasi pasokan seluruh toko cabang.'
                : 'Customer Support 24/7 aktif mendampingi operasional toko Anda.'}
            </p>
          </div>
        </aside>

        {/* Mobile Off-Canvas Drawer Backdrop */}
        {mobileDrawerOpen && (
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 md:hidden transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
        )}

        {/* Mobile Off-Canvas Drawer Panel (Optimized for 6.8" Smartphone Portrait) */}
        <div
          className={`fixed inset-y-0 left-0 w-[84vw] max-w-[320px] bg-white z-50 md:hidden flex flex-col shadow-2xl border-r border-slate-200 transition-transform duration-300 ease-in-out ${
            mobileDrawerOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {/* Drawer Top Header */}
          <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/90 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-blue-950 text-white flex items-center justify-center font-black shadow-xs shrink-0">
                <Store className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-blue-950 truncate">
                  {activeOutlet?.name || 'WELL POS'}
                </div>
                <div className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${activeOutlet?.isWarehouse ? 'bg-indigo-500' : 'bg-emerald-500'}`} />
                  <span>{activeOutlet?.isWarehouse ? 'Pusat Logistik Gudang' : 'Toko Penjualan'}</span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
              title="Tutup Menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Primary Action: ⚡ Buka Terminal Kasir */}
          {activeOutlet && !activeOutlet.isWarehouse && (
            <div className="p-3 bg-blue-50/60 border-b border-blue-100 shrink-0">
              <button
                type="button"
                onClick={() => {
                  onTabChange('pos');
                  setMobileDrawerOpen(false);
                }}
                className={`w-full py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all active:scale-98 cursor-pointer ${
                  activeTab === 'pos'
                    ? 'bg-blue-950 text-white ring-2 ring-blue-500'
                    : 'bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white'
                }`}
              >
                <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
                <span>Buka Terminal Kasir (POS)</span>
              </button>
            </div>
          )}

          {/* Drawer Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-3 text-xs space-y-1 scrollbar-thin">
            {renderNavContent(() => setMobileDrawerOpen(false))}
          </div>

          {/* Drawer Footer User Profile & Actions */}
          <div className="p-3 border-t border-slate-200 bg-slate-50/90 shrink-0 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full bg-blue-900 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                  {user.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">{user.name}</p>
                  <p className="text-[10px] text-slate-400 font-semibold">{user.role}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={onLogout}
                  title="Kunci Layar (PIN Lock)"
                  className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-colors cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={onLogout}
                  title="Keluar Akun"
                  className="p-1.5 rounded-lg bg-white hover:bg-rose-50 hover:text-rose-600 text-slate-600 border border-slate-200 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Pane */}
        <div className={`flex-1 overflow-y-auto ${activeTab === 'pos' ? 'p-0 sm:p-4' : 'p-3 sm:p-8 pb-20 md:pb-8'}`}>
          <div className={activeTab === 'pos' ? 'max-w-[1600px] mx-auto' : 'max-w-6xl mx-auto'}>
            {children}
          </div>
        </div>

        {/* Ergonomic Mobile Bottom Navigation Bar (Prime Thumb Zone) - Hidden when in POS */}
        {activeTab !== 'pos' && (
          <nav className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 px-3 py-1.5 flex items-center justify-around shadow-lg md:hidden">
            {activeOutlet?.isWarehouse ? (
              /* Bottom Nav: Mode Gudang */
              <>
                <button
                  type="button"
                  onClick={() => onTabChange('inventory')}
                  className={`flex flex-col items-center justify-center gap-0.5 min-w-[54px] py-1 transition-colors active:scale-95 cursor-pointer ${
                    activeTab === 'inventory' ? 'text-indigo-900 font-black' : 'text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  <Boxes className="w-5 h-5" />
                  <span className="text-[10px]">Stok</span>
                </button>

                <button
                  type="button"
                  onClick={() => onTabChange('stock_movements')}
                  className={`flex flex-col items-center justify-center gap-0.5 min-w-[54px] py-1 transition-colors active:scale-95 cursor-pointer ${
                    activeTab === 'stock_movements' ? 'text-indigo-900 font-black' : 'text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  <Receipt className="w-5 h-5" />
                  <span className="text-[10px]">Mutasi</span>
                </button>

                <button
                  type="button"
                  onClick={() => onTabChange('suppliers')}
                  className={`flex flex-col items-center justify-center gap-0.5 min-w-[54px] py-1 transition-colors active:scale-95 cursor-pointer ${
                    activeTab === 'suppliers' ? 'text-indigo-900 font-black' : 'text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  <Users className="w-5 h-5" />
                  <span className="text-[10px]">Pemasok</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const storeOutlets = outlets.filter((o) => !o.isWarehouse);
                    if (storeOutlets.length > 0) {
                      onSelectOutlet(storeOutlets[0].id);
                      onTabChange('overview');
                    }
                  }}
                  className="flex flex-col items-center justify-center gap-0.5 min-w-[54px] py-1 text-indigo-700 hover:text-indigo-950 transition-colors active:scale-95 cursor-pointer"
                >
                  <Store className="w-5 h-5" />
                  <span className="text-[10px] font-bold">Ke Toko</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(true)}
                  className="flex flex-col items-center justify-center gap-0.5 min-w-[54px] py-1 text-slate-600 hover:text-slate-900 transition-colors active:scale-95 cursor-pointer"
                >
                  <Menu className="w-5 h-5" />
                  <span className="text-[10px]">Menu</span>
                </button>
              </>
            ) : (
              /* Bottom Nav: Mode Toko Penjualan */
              <>
                <button
                  type="button"
                  onClick={() => onTabChange('pos')}
                  className="flex flex-col items-center justify-center gap-0.5 min-w-[54px] py-1 text-slate-600 hover:text-blue-900 transition-colors active:scale-95 cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-xs">
                    <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                  </div>
                  <span className="text-[10px] font-extrabold text-blue-950">Kasir</span>
                </button>

                <button
                  type="button"
                  onClick={() => onTabChange('overview')}
                  className={`flex flex-col items-center justify-center gap-0.5 min-w-[54px] py-1 transition-colors active:scale-95 cursor-pointer ${
                    activeTab === 'overview' ? 'text-blue-900 font-black' : 'text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  <LayoutDashboard className="w-5 h-5" />
                  <span className="text-[10px]">Ringkasan</span>
                </button>

                <button
                  type="button"
                  onClick={() => onTabChange('orders')}
                  className={`flex flex-col items-center justify-center gap-0.5 min-w-[54px] py-1 transition-colors active:scale-95 cursor-pointer ${
                    activeTab === 'orders' ? 'text-blue-900 font-black' : 'text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  <Receipt className="w-5 h-5" />
                  <span className="text-[10px]">Pesanan</span>
                </button>

                <button
                  type="button"
                  onClick={() => onTabChange('inventory')}
                  className={`flex flex-col items-center justify-center gap-0.5 min-w-[54px] py-1 transition-colors active:scale-95 cursor-pointer ${
                    activeTab === 'inventory' ? 'text-blue-900 font-black' : 'text-slate-500 hover:text-slate-800 font-medium'
                  }`}
                >
                  <Boxes className="w-5 h-5" />
                  <span className="text-[10px]">Stok</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(true)}
                  className="flex flex-col items-center justify-center gap-0.5 min-w-[54px] py-1 text-slate-600 hover:text-blue-900 transition-colors active:scale-95 cursor-pointer"
                >
                  <Menu className="w-5 h-5" />
                  <span className="text-[10px]">Menu</span>
                </button>
              </>
            )}
          </nav>
        )}
      </div>
    </div>
  );
};
