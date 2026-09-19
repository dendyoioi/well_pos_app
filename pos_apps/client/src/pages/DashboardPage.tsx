import React, { useState, useEffect } from 'react';
import {
  Store,
  LogOut,
  Shield,
  ShoppingBag,
  Activity,
  CheckCircle2,
  Clock,
  ArrowRight,
  Database,
  Boxes,
  LayoutDashboard,
  CreditCard,
  ShoppingCart,
  Receipt,
  TrendingUp,
  PackageCheck,
  ClipboardList,
  Users,
  Contact,
  Sparkles,
  Printer,
  Warehouse,
  Lock,
} from 'lucide-react';
import type { User, UserRole } from '../types/auth';
import type { Outlet, OutletFee } from '../types/outlet';
import type { Order } from '../types/order';
import { ProductsView } from './ProductsView';
import { InventoryView } from './InventoryView';
import { PosTerminalView } from './PosTerminalView';
import { OrdersView } from './OrdersView';
import { CustomersView } from './CustomersView';
import { FinancialReportView } from './FinancialReportView';
import { ShiftsAuditView } from './ShiftsAuditView';
import { UsersView } from './UsersView';
import { OutletsView } from './OutletsView';
import { OnboardingWizardModal } from '../components/saas/OnboardingWizardModal';
import { api } from '../services/api';

interface DashboardPageProps {
  user: User;
  onLogout: () => void;
  onUserChange?: (user: User) => void;
}

type TabKey = 'pos' | 'overview' | 'products' | 'inventory' | 'orders' | 'customers' | 'reports' | 'shifts' | 'users' | 'outlets';

const ROLE_TABS: Record<UserRole, TabKey[]> = {
  CASHIER: ['pos', 'orders', 'customers', 'shifts'],
  WAREHOUSE: ['inventory', 'products', 'overview'],
  SUPERVISOR: ['overview', 'pos', 'orders', 'customers', 'shifts', 'products', 'inventory', 'reports', 'outlets'],
  ADMIN: ['overview', 'pos', 'products', 'inventory', 'orders', 'customers', 'shifts', 'reports', 'users', 'outlets'],
};

const DEFAULT_TAB: Record<UserRole, TabKey> = {
  CASHIER: 'pos',
  WAREHOUSE: 'inventory',
  SUPERVISOR: 'overview',
  ADMIN: 'overview',
};

export const DashboardPage: React.FC<DashboardPageProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<TabKey>(DEFAULT_TAB[user.role] || 'pos');
  const [healthStatus, setHealthStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [productCount, setProductCount] = useState<number>(8);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);

  // Multi-Outlet Management State (PRO Multi-Branch Architecture)
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [activeOutlet, setActiveOutlet] = useState<Outlet | null>(null);
  const [appendOrderData, setAppendOrderData] = useState<Order | null>(null);
  // Fetch all outlets belonging to this store's tenant
  const fetchOutlets = async () => {
    try {
      const res = await api.getOutlets();
      if (res.status === 'success' && res.data && res.data.length > 0) {
        setOutlets(res.data);
        setActiveOutlet((current) => {
          // Kasir & Gudang harus terkunci ke cabang penugasan mereka
          if (user.role === 'CASHIER' || user.role === 'WAREHOUSE') {
            const userOutlet = res.data.find((o: Outlet) => o.id === user.outletId || o.id === user.outlet?.id);
            if (userOutlet) return userOutlet;
          }

          if (current) {
            const found = res.data.find((o: Outlet) => o.id === current.id);
            if (found) return found;
          }
          const matched = res.data.find((o: Outlet) => o.id === user.outletId || o.id === user.outlet?.id);
          return matched || res.data[0];
        });
      }
    } catch (err) {
      console.error('Gagal mengambil daftar cabang:', err);
    }
  };

  useEffect(() => {
    fetchOutlets();
  }, [user.id, user.tenantId, user.outletId, user.role]);

  const handleOutletSelect = (outletId: string) => {
    const selected = outlets.find((o) => o.id === outletId);
    if (selected) {
      setActiveOutlet(selected);
    }
  };

  const handleUpdateOutletFees = (updatedFees: OutletFee[]) => {
    if (!activeOutlet) return;
    const updated = { ...activeOutlet, feesConfig: updatedFees };
    setActiveOutlet(updated);
    setOutlets((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  // Sesuaikan tab aktif bila user switch role atau tab tidak diizinkan
  useEffect(() => {
    const allowed = ROLE_TABS[user.role] || ['pos'];
    if (!allowed.includes(activeTab)) {
      setActiveTab(DEFAULT_TAB[user.role] || allowed[0]);
    }
  }, [user.role, activeTab]);

  useEffect(() => {
    api
      .checkHealth()
      .then((res) => {
        if (res.status === 'ok') setHealthStatus('ok');
        else setHealthStatus('error');
      })
      .catch(() => setHealthStatus('error'));
  }, []);

  const [usersList, setUsersList] = useState<any[]>([]);

  useEffect(() => {
    if (user.role === 'ADMIN' || (user as any).role === 'OWNER') {
      api
        .getUsers()
        .then((res) => {
          if (res.status === 'success' && res.data) {
            setUsersList(res.data);
          }
        })
        .catch(() => {});
    }
  }, [user.id, user.tenantId]);

  useEffect(() => {
    if (!activeOutlet?.id) return;
    api
      .getProducts({ outletId: activeOutlet.id, isActive: 'all' })
      .then((res) => {
        if (res.status === 'success') {
          setProductCount(res.data.length);
          if (res.data.length === 0 && (user.role === 'ADMIN' || (user as any).role === 'OWNER')) {
            setShowOnboardingWizard(true);
          }
        }
      })
      .catch(() => {});
  }, [activeOutlet?.id]);

  // Perhitungan Checklist Setup Awal (0 - 100% dengan 5 Langkah)
  const hasStep1Address = Boolean(activeOutlet?.address && activeOutlet?.phone && !activeOutlet?.address?.includes('Setup di Onboarding'));
  const hasStep2Warehouse = Boolean(activeOutlet?.warehouseId || outlets.some((o) => o.isWarehouse));
  const hasStep3Receipt = Boolean(activeOutlet?.receiptConfig?.paperSize);
  const hasStep4Cashier = usersList.some((u) => u.role === 'CASHIER') || (activeOutlet?._count?.users ?? 0) > 1;
  const hasStep5Product = productCount > 0;

  const completedStepsCount =
    (hasStep1Address ? 1 : 0) +
    (hasStep2Warehouse ? 1 : 0) +
    (hasStep3Receipt ? 1 : 0) +
    (hasStep4Cashier ? 1 : 0) +
    (hasStep5Product ? 1 : 0);
  const setupPercent = Math.round((completedStepsCount / 5) * 100);
  const isSetupIncomplete = setupPercent < 100 && (user.role === 'ADMIN' || (user as any).role === 'OWNER');


  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return { label: 'Admin / Owner', color: 'bg-purple-100 text-purple-800 border-purple-200' };
      case 'SUPERVISOR':
        return { label: 'Supervisor', color: 'bg-amber-100 text-amber-800 border-amber-200' };
      case 'WAREHOUSE':
        return { label: 'Staf Gudang', color: 'bg-sky-100 text-sky-800 border-sky-200' };
      case 'CASHIER':
      default:
        return { label: 'Kasir Utama', color: 'bg-blue-100 text-blue-900 border-blue-200' };
    }
  };

  const badge = getRoleBadge(user.role);
  const allowedTabs = ROLE_TABS[user.role] || ['pos'];

  // Hanya Admin & Supervisor yang berhak berpindah cabang (Multi-Outlet Switcher)
  const canSwitchOutlet = user.role === 'ADMIN' || user.role === 'SUPERVISOR';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Top Header Navigation */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-20 px-4 sm:px-8 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/20 shrink-0">
            <Store className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-extrabold text-blue-950 tracking-tight">
                <span>{user.tenant?.name || activeOutlet?.name || 'Well POS'}</span>
              </h1>
              {/* Multi-Outlet Dropdown Selector & Manage Shortcut:
                  - Kasir & Gudang: Terkunci pada cabang penugasan (Badge tetap)
                  - Admin & SPV: Memiliki wewenang dropdown switcher & shortcut kelola cabang */}
              {canSwitchOutlet && outlets.length > 1 ? (
                <div className="relative inline-flex items-center gap-1.5">
                  <select
                    value={activeOutlet?.id || ''}
                    onChange={(e) => handleOutletSelect(e.target.value)}
                    className="bg-blue-50 border border-blue-300 text-blue-950 text-xs font-black rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs hover:bg-blue-100 transition-colors"
                    title="Ganti Cabang Aktif (Akses Khusus Admin / Supervisor)"
                  >
                    {outlets.map((o) => (
                      <option key={o.id} value={o.id}>
                        📍 {o.name}
                      </option>
                    ))}
                  </select>
                  {allowedTabs.includes('outlets') && (
                    <button
                      onClick={() => setActiveTab('outlets')}
                      className="px-2 py-1 text-[11px] font-bold bg-slate-100 hover:bg-blue-100 hover:text-blue-900 text-slate-700 border border-slate-300 rounded-lg flex items-center gap-1 transition-all shadow-xs"
                      title="Buka Menu Kelola Cabang"
                    >
                      <Store className="w-3 h-3 text-blue-900" />
                      <span className="hidden sm:inline">Kelola Cabang</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-lg bg-blue-50 text-blue-950 border border-blue-200 flex items-center gap-1 shadow-xs">
                    <Store className="w-3 h-3 text-blue-800" />
                    <span>{activeOutlet?.name || user.outlet?.name || 'Cabang Utama'}</span>
                    {!canSwitchOutlet && (
                      <span className="text-[9px] bg-blue-200/60 text-blue-900 font-semibold px-1 py-0.2 rounded ml-0.5">
                        Terkunci
                      </span>
                    )}
                  </span>
                  {canSwitchOutlet && allowedTabs.includes('outlets') && (
                    <button
                      onClick={() => setActiveTab('outlets')}
                      className="px-2 py-0.5 text-[11px] font-bold bg-slate-100 hover:bg-blue-100 hover:text-blue-900 text-slate-700 border border-slate-300 rounded-lg flex items-center gap-1 transition-all shadow-xs"
                      title="Kelola & Tambah Cabang Toko"
                    >
                      <Store className="w-3 h-3 text-blue-900" />
                      <span className="hidden sm:inline">Kelola</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium truncate max-w-xs sm:max-w-md">
              {activeOutlet?.address || user.outlet?.address || 'Jakarta'}
            </p>
          </div>
        </div>

        {/* User Profile & Logout */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-sm font-bold text-slate-800">{user.name}</span>
            <span className="text-xs text-slate-500">{user.email}</span>
          </div>

          <span
            className={`text-xs px-3 py-1 rounded-full border font-bold ${badge.color}`}
          >
            {badge.label}
          </span>

          <button
            onClick={onLogout}
            title="Kunci Layar Terminal Kasir (PIN Lock)"
            className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-all font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden sm:inline">Kunci Terminal</span>
          </button>

          <button
            onClick={onLogout}
            title="Keluar Akun"
            className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-slate-200 transition-all text-slate-600 shadow-sm cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Subnav Navigation Tabs (Filtered strictly by Role) */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-8 py-2 sticky top-[61px] lg:top-[65px] z-10 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center gap-2 overflow-x-auto">
          {/* Tab POS Kasir */}
          {allowedTabs.includes('pos') && (
            <button
              onClick={() => setActiveTab('pos')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'pos'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-blue-950 hover:bg-slate-100'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Mesin Kasir (POS)</span>
            </button>
          )}

          {/* Tab Ringkasan Toko */}
          {allowedTabs.includes('overview') && (
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'overview'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-blue-950 hover:bg-slate-100'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Ringkasan {user.role === 'WAREHOUSE' ? 'Gudang' : 'Toko'}</span>
            </button>
          )}

          {/* Tab Katalog Produk */}
          {allowedTabs.includes('products') && (
            <button
              onClick={() => setActiveTab('products')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'products'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-blue-950 hover:bg-slate-100'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Katalog Produk</span>
              <span className="text-[11px] px-1.5 py-0.2 rounded-md bg-blue-800/40 text-current">
                {productCount}
              </span>
            </button>
          )}

          {/* Tab Stok & Kartu Mutasi */}
          {allowedTabs.includes('inventory') && (
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'inventory'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-blue-950 hover:bg-slate-100'
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Stok & Kartu Mutasi</span>
            </button>
          )}

          {/* Tab Riwayat Transaksi Penjualan */}
          {allowedTabs.includes('orders') && (
            <button
              onClick={() => setActiveTab('orders')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'orders'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-blue-950 hover:bg-slate-100'
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Riwayat Transaksi</span>
            </button>
          )}

          {/* Tab Master Pelanggan (CRM) */}
          {allowedTabs.includes('customers') && (
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'customers'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-blue-950 hover:bg-slate-100'
              }`}
            >
              <Contact className="w-4 h-4" />
              <span>Data Pelanggan</span>
            </button>
          )}

          {/* Tab Audit Shift Kasir */}
          {allowedTabs.includes('shifts') && (
            <button
              onClick={() => setActiveTab('shifts')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'shifts'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-blue-950 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{user.role === 'CASHIER' ? 'Shift Kasir' : 'Audit Shift'}</span>
            </button>
          )}

          {/* Tab Laporan Finansial */}
          {allowedTabs.includes('reports') && (
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'reports'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-blue-950 hover:bg-slate-100'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>Laporan Finansial</span>
            </button>
          )}

          {/* Tab Kelola Staf / Pengguna (Admin Only) */}
          {allowedTabs.includes('users') && (
            <button
              onClick={() => setActiveTab('users')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'users'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-blue-950 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Kelola Staf</span>
            </button>
          )}

          {/* Tab Kelola Cabang Toko (Multi-Outlet PRO) */}
          {allowedTabs.includes('outlets') && (
            <button
              onClick={() => setActiveTab('outlets')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'outlets'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-blue-950 hover:bg-slate-100'
              }`}
            >
              <Store className="w-4 h-4" />
              <span>Cabang Toko</span>
              {outlets.filter((o) => !o.isWarehouse).length > 0 && (
                <span className="text-[11px] px-1.5 py-0.2 rounded-md bg-blue-800/40 text-current">
                  {outlets.filter((o) => !o.isWarehouse).length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8">
        {/* Widget Panduan & Progres Setup Awal (Jika Belum 100%) */}
        {isSetupIncomplete && (
          <div className="mb-6 p-5 sm:p-6 bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white rounded-3xl border border-indigo-500/30 shadow-2xl relative overflow-hidden animate-in fade-in">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center text-xl shrink-0">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold uppercase tracking-wide">
                      Setup Toko Belum 100%
                    </span>
                    <span className="text-xs font-bold text-slate-300">
                      Progres: <span className="text-emerald-400 font-black">{setupPercent}% Selesai</span>
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-white mt-1">
                    Panduan & Kelengkapan Setup Awal Toko Anda
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowOnboardingWizard(true)}
                className="w-full sm:w-auto px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-emerald-500/30 transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0"
              >
                <span>Lanjutkan Setup Wizard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-white/10 rounded-full h-2.5 overflow-hidden mb-4 p-0.5 border border-white/5">
              <div
                className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.max(setupPercent, 5)}%` }}
              />
            </div>

            {/* Checklist Grid (5 Langkah Terstruktur) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {/* Item 1 */}
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  hasStep1Address
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-extrabold flex items-center gap-1.5">
                    <Store className="w-3.5 h-3.5" />
                    <span>1. Profil & WA</span>
                  </span>
                  {hasStep1Address ? (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded">
                      Selesai
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.2 rounded">
                      Pending
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  {hasStep1Address
                    ? `${activeOutlet?.phone || 'Nomor'} tercatat untuk header struk`
                    : 'Alamat & nomor WA hotline toko'}
                </p>
              </div>

              {/* Item 2 */}
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  hasStep2Warehouse
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-extrabold flex items-center gap-1.5">
                    <Warehouse className="w-3.5 h-3.5" />
                    <span>2. Gudang Utama</span>
                  </span>
                  {hasStep2Warehouse ? (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded">
                      Terhubung
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.2 rounded">
                      Pending
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  {hasStep2Warehouse
                    ? 'Gudang pusat logistik & stok buffer aktif'
                    : 'Setup gudang utama penampung stok'}
                </p>
              </div>

              {/* Item 3 */}
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  hasStep3Receipt
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-extrabold flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5" />
                    <span>3. Ukuran Struk</span>
                  </span>
                  {hasStep3Receipt ? (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded">
                      {activeOutlet?.receiptConfig?.paperSize}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.2 rounded">
                      Pending
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  {hasStep3Receipt
                    ? `Default printer outlet: ${activeOutlet?.receiptConfig?.paperSize}`
                    : 'Pilih standar printer kasir (58mm / 80mm)'}
                </p>
              </div>

              {/* Item 4 */}
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  hasStep4Cashier
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-extrabold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>4. Staf Kasir</span>
                  </span>
                  {hasStep4Cashier ? (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded">
                      Selesai
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.2 rounded">
                      Pending
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  {hasStep4Cashier
                    ? 'Staf kasir dengan PIN 6 digit siap bertransaksi'
                    : 'Buat kasir pertama agar staf counter bisa login'}
                </p>
              </div>

              {/* Item 5 */}
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  hasStep5Product
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-extrabold flex items-center gap-1.5">
                    <PackageCheck className="w-3.5 h-3.5" />
                    <span>5. 1 Produk Awal</span>
                  </span>
                  {hasStep5Product ? (
                    <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-1.5 py-0.2 rounded">
                      {productCount} Produk
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-1.5 py-0.2 rounded">
                      Pending
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  {hasStep5Product
                    ? 'Produk perdana dan alokasi saldo awal siap'
                    : 'Buat minimal 1 produk perdana siap jual'}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pos' ? (
          <PosTerminalView
            activeOutlet={activeOutlet}
            currentUserRole={user.role}
            onOutletFeesUpdated={handleUpdateOutletFees}
            appendOrderData={appendOrderData}
            onClearAppendOrder={() => setAppendOrderData(null)}
          />
        ) : activeTab === 'overview' ? (
          <div className="space-y-8">
            {/* Welcome Hero Banner in Deep Navy */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 border border-blue-800/40 p-6 sm:p-8 shadow-xl text-white">
              <div className="relative z-10 max-w-2xl">
                <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-800/80 border border-blue-700/60 text-blue-200 text-xs font-semibold mb-3">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>
                    {user.role === 'WAREHOUSE'
                      ? 'Portal Manajemen Gudang & Logistik Stok Aktif'
                      : user.role === 'CASHIER'
                      ? 'Portal Mesin Kasir & Transaksi Siap Digunakan'
                      : 'Portal Administrasi & Finansial Multi-Role Aktif'}
                  </span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                  Selamat datang, {user.name.split(' ')[0]}! 👋
                </h2>
                <p className="text-sm text-blue-100/90 mt-2 leading-relaxed">
                  {user.role === 'WAREHOUSE'
                    ? 'Anda masuk sebagai Tim Gudang. Catat penerimaan barang (PO Supplier), pengeluaran barang rusak/kedaluwarsa, stock opname fisik, serta pantau alert stok menipis secara real-time.'
                    : user.role === 'CASHIER'
                    ? 'Anda masuk sebagai Kasir. Buka shift kerja di awal sesi, lakukan transaksi penjualan cepat, cetak struk thermal atau kirim via email, dan tutup shift (Z-Report) di akhir sesi.'
                    : 'Sistem POS terintegrasi penuh: Mesin kasir responsif, barcode scanner USB, cetak struk thermal 58/80mm, audit shift kasir (X/Z Report), dan dashboard laporan laba rugi HPP.'}
                </p>

                {/* Role-tailored action shortcuts */}
                <div className="flex items-center gap-3 mt-5 flex-wrap">
                  {allowedTabs.includes('pos') && (
                    <button
                      onClick={() => setActiveTab('pos')}
                      className="px-5 py-2.5 bg-white text-blue-950 font-black rounded-xl text-xs sm:text-sm shadow-md hover:bg-blue-50 transition-all flex items-center gap-2"
                    >
                      <ShoppingCart className="w-4 h-4 text-blue-900" />
                      <span>Mulai Transaksi Kasir (F4)</span>
                    </button>
                  )}

                  {allowedTabs.includes('inventory') && (
                    <button
                      onClick={() => setActiveTab('inventory')}
                      className="px-4 py-2 bg-blue-800/70 hover:bg-blue-800 text-white font-bold rounded-xl text-xs sm:text-sm border border-blue-700 transition-all flex items-center gap-1.5"
                    >
                      <PackageCheck className="w-4 h-4 text-sky-300" />
                      <span>Mutasi Stok & Opname</span>
                    </button>
                  )}

                  {allowedTabs.includes('shifts') && (
                    <button
                      onClick={() => setActiveTab('shifts')}
                      className="px-4 py-2 bg-blue-800/70 hover:bg-blue-800 text-white font-bold rounded-xl text-xs sm:text-sm border border-blue-700 transition-all flex items-center gap-1.5"
                    >
                      <Clock className="w-4 h-4 text-blue-200" />
                      <span>{user.role === 'CASHIER' ? 'Buka/Tutup Shift' : 'Audit Shift'}</span>
                    </button>
                  )}

                  {allowedTabs.includes('reports') && (
                    <button
                      onClick={() => setActiveTab('reports')}
                      className="px-4 py-2 bg-blue-800/70 hover:bg-blue-800 text-white font-bold rounded-xl text-xs sm:text-sm border border-blue-700 transition-all flex items-center gap-1.5"
                    >
                      <TrendingUp className="w-4 h-4 text-emerald-300" />
                      <span>Laporan Finansial</span>
                    </button>
                  )}

                  {allowedTabs.includes('products') && (
                    <button
                      onClick={() => setActiveTab('products')}
                      className="px-4 py-2 bg-blue-800/70 hover:bg-blue-800 text-white font-bold rounded-xl text-xs sm:text-sm border border-blue-700 transition-all flex items-center gap-1.5"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Katalog Produk</span>
                    </button>
                  )}

                  {allowedTabs.includes('users') && (
                    <button
                      onClick={() => setActiveTab('users')}
                      className="px-4 py-2 bg-blue-800/70 hover:bg-blue-800 text-white font-bold rounded-xl text-xs sm:text-sm border border-blue-700 transition-all flex items-center gap-1.5"
                    >
                      <Users className="w-4 h-4 text-purple-300" />
                      <span>Kelola Staf & PIN</span>
                    </button>
                  )}

                  {allowedTabs.includes('outlets') && (
                    <button
                      onClick={() => setActiveTab('outlets')}
                      className="px-4 py-2 bg-blue-800/70 hover:bg-blue-800 text-white font-bold rounded-xl text-xs sm:text-sm border border-blue-700 transition-all flex items-center gap-1.5"
                    >
                      <Store className="w-4 h-4 text-sky-300" />
                      <span>Kelola Cabang ({outlets.filter((o) => !o.isWarehouse).length})</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Status Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Outlet Info */}
              <div
                onClick={() => allowedTabs.includes('outlets') && setActiveTab('outlets')}
                className={`p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                  allowedTabs.includes('outlets') ? 'cursor-pointer hover:border-blue-300' : ''
                }`}
                title={allowedTabs.includes('outlets') ? 'Klik untuk kelola cabang toko' : undefined}
              >
                <div className="flex items-center justify-between text-slate-500 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider">Cabang Toko</span>
                  <Store className="w-4 h-4 text-blue-900" />
                </div>
                <div>
                  <div className="text-lg font-extrabold text-blue-950 truncate">
                    {activeOutlet?.name || user.outlet?.name || 'Toko Utama'}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                    <span>ID: {(activeOutlet?.id || user.outlet?.id || 'Default').slice(0, 8)}...</span>
                    {allowedTabs.includes('outlets') && (
                      <span className="text-[11px] font-bold text-blue-700 hover:underline">Kelola &rarr;</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Card 2: Role & PIN */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider">Hak Akses & PIN</span>
                  <Shield className="w-4 h-4 text-blue-900" />
                </div>
                <div>
                  <div className="text-lg font-extrabold text-blue-950">{badge.label}</div>
                  <p className="text-xs text-slate-500 mt-1">
                    PIN Kasir: <span className="font-semibold text-blue-900">{user.pin ? `•••••• (${user.pin})` : 'Belum diatur'}</span>
                  </p>
                </div>
              </div>

              {/* Card 3: Database & Sample Products */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider">Katalog Produk</span>
                  <Database className="w-4 h-4 text-blue-900" />
                </div>
                <div>
                  <div className="text-lg font-extrabold text-blue-950">{productCount} Produk Terdata</div>
                  <p className="text-xs text-slate-500 mt-1">
                    {user.role === 'ADMIN' ? 'Akses Tambah/Ubah/Hapus Aktif' : 'Akses Hanya Lihat (Read-Only)'}
                  </p>
                </div>
              </div>

              {/* Card 4: Backend API Health */}
              <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider">Status API Backend</span>
                  <Activity className="w-4 h-4 text-blue-900" />
                </div>
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${
                      healthStatus === 'ok'
                        ? 'bg-emerald-500 ring-4 ring-emerald-100'
                        : healthStatus === 'error'
                        ? 'bg-rose-500'
                        : 'bg-amber-400'
                    }`}
                  />
                  <span className="text-lg font-extrabold text-blue-950">
                    {healthStatus === 'ok' ? 'Terhubung (200)' : healthStatus === 'error' ? 'Terputus' : 'Memeriksa...'}
                  </span>
                </div>
              </div>
            </div>

            {/* Workflow Guidance per Role */}
            <div>
              <h3 className="text-lg font-extrabold text-blue-950 mb-4 flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-blue-900" />
                <span>Panduan Alur Pengetesan Manual Role Ini</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {user.role === 'CASHIER' ? (
                  <>
                    <div
                      onClick={() => setActiveTab('shifts')}
                      className="p-6 rounded-2xl bg-white border-2 border-blue-900 shadow-md flex flex-col justify-between cursor-pointer hover:scale-[1.01] transition-all"
                    >
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center mb-3 font-bold">
                          1
                        </div>
                        <h4 className="font-bold text-blue-950 text-base">Buka Shift Kasir</h4>
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                          Buka menu Shift Kasir, masukkan modal awal kas laci (misal Rp 200.000), dan mulai sesi penjualan Anda.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-blue-900 font-extrabold flex items-center justify-between">
                        <span>Buka Shift</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>

                    <div
                      onClick={() => setActiveTab('pos')}
                      className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                    >
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-3 font-bold">
                          2
                        </div>
                        <h4 className="font-bold text-blue-950 text-base">Transaksi Kasir & Struk</h4>
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                          Pilih produk minuman/makanan, atur jumlah & diskon, bayar Tunai atau QRIS, lalu cetak/unduh struk thermal.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-blue-900 font-bold flex items-center justify-between">
                        <span>Buka Kasir (F4)</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>

                    <div
                      onClick={() => setActiveTab('shifts')}
                      className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                    >
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-3 font-bold">
                          3
                        </div>
                        <h4 className="font-bold text-blue-950 text-base">Tutup Shift (Z-Report)</h4>
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                          Hitung uang fisik di laci kasir, input ke sistem, cetak laporan Z-Report penutupan shift, dan verifikasi selisih kas.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-blue-900 font-bold flex items-center justify-between">
                        <span>Tutup Shift</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </>
                ) : user.role === 'WAREHOUSE' ? (
                  <>
                    <div
                      onClick={() => setActiveTab('inventory')}
                      className="p-6 rounded-2xl bg-white border-2 border-blue-900 shadow-md flex flex-col justify-between cursor-pointer hover:scale-[1.01] transition-all"
                    >
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center mb-3 font-bold">
                          1
                        </div>
                        <h4 className="font-bold text-blue-950 text-base">Catat Stok Masuk (PO)</h4>
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                          Terima pasokan barang dari supplier, catat jumlah qty masuk dan nomor referensi PO/Surat Jalan.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-blue-900 font-extrabold flex items-center justify-between">
                        <span>Catat Stok Masuk</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>

                    <div
                      onClick={() => setActiveTab('inventory')}
                      className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                    >
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-3 font-bold">
                          2
                        </div>
                        <h4 className="font-bold text-blue-950 text-base">Penyesuaian & Opname</h4>
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                          Lakukan penyesuaian fisik (*stock opname*) atau catat barang rusak/kedaluwarsa sebagai stok keluar.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-blue-900 font-bold flex items-center justify-between">
                        <span>Opname Stok</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>

                    <div
                      onClick={() => setActiveTab('products')}
                      className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                    >
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-3 font-bold">
                          3
                        </div>
                        <h4 className="font-bold text-blue-950 text-base">Katalog Produk (Read-Only)</h4>
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                          Lihat daftar SKU, kategori, dan barcode produk tanpa risiko mengubah harga jual atau HPP produk.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-blue-900 font-bold flex items-center justify-between">
                        <span>Lihat Katalog</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      onClick={() => setActiveTab('pos')}
                      className="p-6 rounded-2xl bg-white border-2 border-blue-900 shadow-md flex flex-col justify-between cursor-pointer hover:scale-[1.01] transition-all"
                    >
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center mb-3 font-bold">
                          1
                        </div>
                        <h4 className="font-bold text-blue-950 text-base">Operasional Kasir (POS)</h4>
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                          Buka mesin kasir, lakukan penjualan barang, diskon manual, cetak struk thermal 58/80mm, atau kirim struk email.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-blue-900 font-extrabold flex items-center justify-between">
                        <span>Buka Terminal Kasir</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>

                    <div
                      onClick={() => setActiveTab('shifts')}
                      className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                    >
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-3 font-bold">
                          2
                        </div>
                        <h4 className="font-bold text-blue-950 text-base">Audit Shift & Laci Uang</h4>
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                          Audit laporan shift kasir, periksa selisih uang fisik vs kalkulasi sistem, dan pantau cetakan X-Report & Z-Report.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-blue-900 font-bold flex items-center justify-between">
                        <span>Buka Audit Shift</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>

                    <div
                      onClick={() => setActiveTab('reports')}
                      className="p-6 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between cursor-pointer"
                    >
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-3 font-bold">
                          3
                        </div>
                        <h4 className="font-bold text-blue-950 text-base">Laporan Finansial & HPP</h4>
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                          Analisis laba kotor, HPP riil, performa metode pembayaran, breakdown per kategori, dan ekspor data ke format CSV.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-blue-900 font-bold flex items-center justify-between">
                        <span>Buka Laporan</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'products' ? (
          <ProductsView
            userRole={user.role}
            outletId={activeOutlet?.id}
            onProductCountChange={(count) => setProductCount(count)}
          />
        ) : activeTab === 'orders' ? (
          <OrdersView
            activeOutlet={activeOutlet}
            onAppendOrder={(order) => {
              setAppendOrderData(order);
              setActiveTab('pos');
            }}
          />
        ) : activeTab === 'customers' ? (
          <CustomersView />
        ) : activeTab === 'shifts' ? (
          <ShiftsAuditView />
        ) : activeTab === 'reports' ? (
          <FinancialReportView />
        ) : activeTab === 'users' ? (
          <UsersView />
        ) : activeTab === 'outlets' ? (
          <OutletsView
            activeOutletId={activeOutlet?.id}
            onSelectActiveOutlet={(id) => {
              handleOutletSelect(id);
            }}
            onOutletsUpdated={fetchOutlets}
          />
        ) : (
          <InventoryView activeOutlet={activeOutlet} />
        )}

        {/* Modal Onboarding Wizard (4 Steps) */}
        {showOnboardingWizard && activeOutlet && (
          <OnboardingWizardModal
            isOpen={showOnboardingWizard}
            onClose={() => setShowOnboardingWizard(false)}
            outletId={activeOutlet.id}
            businessName={(user as any).businessName || activeOutlet.name}
            onComplete={() => {
              setShowOnboardingWizard(false);
              fetchOutlets();
              window.location.reload();
            }}
          />
        )}
      </main>
    </div>
  );
};
