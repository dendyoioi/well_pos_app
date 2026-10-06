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
  Lock,
  ExternalLink,
  Smartphone,
  Menu,
  X,
  UtensilsCrossed,
  Ticket,
  FileText,
  ArrowLeftRight,
  Bluetooth,
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
import { ProductAnalyticsView } from './ProductAnalyticsView';
import { ShiftsAuditView } from './ShiftsAuditView';
import { UsersView } from './UsersView';
import { StaffRolesView } from './StaffRolesView';
import { QrTablesView } from './QrTablesView';
import { QrMenuSettingsView } from './QrMenuSettingsView';
import { QrLiveOrdersView } from './QrLiveOrdersView';
import { CustomerQrMenuView } from './CustomerQrMenuView';
import type { QrLiveOrder } from '../types/qr_menu';
import { CategoriesView } from './CategoriesView';
import { ModifiersView } from './ModifiersView';
import { RecipesView } from './RecipesView';
import { OutletsView } from './OutletsView';
import { SuppliersView } from './SuppliersView';
import { PromotionsView } from './PromotionsView';
import { ReceiptSettingsView } from './ReceiptSettingsView';
import { TaxesSettingsView } from './TaxesSettingsView';
import { PaymentSettingsView } from './PaymentSettingsView';
import { SalesChannelsSettingsView } from './SalesChannelsSettingsView';
import { LoyaltySettingsView } from './LoyaltySettingsView';
import { PurchaseOrdersView } from './PurchaseOrdersView';
import { StockTransfersView } from './StockTransfersView';
import { OnboardingWizardModal } from '../components/saas/OnboardingWizardModal';
import { FullScreenStoreWizard } from '../components/saas/FullScreenStoreWizard';
import { BackofficeLayout } from '../components/saas/BackofficeLayout';
import { BusinessSummaryView } from '../components/saas/BusinessSummaryView';
import { BillingTokensView } from './BillingTokensView';
import { UserGuideView } from './UserGuideView';
import { PwaInstallButton } from '../components/PwaInstallBanner';
import { BluetoothSettingsModal } from '../components/pos/BluetoothSettingsModal';
import { api } from '../services/api';

interface DashboardPageProps {
  user: User;
  onLogout: () => void;
  onUserChange?: (user: User) => void;
}

type TabKey =
  | 'pos'
  | 'overview'
  | 'billing_tokens'
  // Menu & Produk
  | 'products'
  | 'categories'
  | 'modifiers'
  | 'recipes'
  // Buku Menu QR
  | 'qr_tables'
  | 'qr_settings'
  | 'qr_orders'
  | 'qr_guest_menu'
  // Bahan Baku & Stok
  | 'inventory'
  | 'stock_movements'
  | 'purchase_orders'
  | 'transfers'
  | 'suppliers'
  // Transaksi
  | 'orders'
  // Laporan
  | 'reports'
  | 'shifts'
  | 'product_analytics'
  // Promosi & Diskon
  | 'promotions'
  | 'customers'
  // Staf
  | 'staff_users'
  | 'staff_roles'
  | 'users'
  // Pengaturan
  | 'settings_receipt'
  | 'settings_taxes'
  | 'settings_payment'
  | 'settings_channels'
  | 'settings_loyalty'
  | 'outlets'
  | 'guide';

const ROLE_TABS: Record<UserRole, TabKey[]> = {
  CASHIER: ['pos', 'orders', 'customers', 'shifts', 'qr_orders', 'guide'],
  WAREHOUSE: [
    'inventory',
    'stock_movements',
    'purchase_orders',
    'transfers',
    'suppliers',
    'recipes',
    'products',
    'overview',
    'guide',
  ],
  SUPERVISOR: [
    'overview',
    'pos',
    'orders',
    'customers',
    'shifts',
    'products',
    'categories',
    'modifiers',
    'recipes',
    'qr_tables',
    'qr_settings',
    'qr_orders',
    'qr_guest_menu',
    'inventory',
    'stock_movements',
    'purchase_orders',
    'transfers',
    'suppliers',
    'reports',
    'product_analytics',
    'promotions',
    'staff_users',
    'settings_payment',
    'settings_channels',
    'settings_loyalty',
    'outlets',
    'guide',
  ],
  ADMIN: [
    'overview',
    'billing_tokens',
    'pos',
    'products',
    'categories',
    'modifiers',
    'recipes',
    'qr_tables',
    'qr_settings',
    'qr_orders',
    'qr_guest_menu',
    'inventory',
    'stock_movements',
    'purchase_orders',
    'transfers',
    'suppliers',
    'orders',
    'customers',
    'shifts',
    'reports',
    'product_analytics',
    'promotions',
    'staff_users',
    'staff_roles',
    'users',
    'settings_receipt',
    'settings_taxes',
    'settings_payment',
    'settings_channels',
    'settings_loyalty',
    'outlets',
    'guide',
  ],
  OWNER: [
    'overview',
    'billing_tokens',
    'pos',
    'products',
    'categories',
    'modifiers',
    'recipes',
    'qr_tables',
    'qr_settings',
    'qr_orders',
    'qr_guest_menu',
    'inventory',
    'stock_movements',
    'purchase_orders',
    'transfers',
    'suppliers',
    'orders',
    'customers',
    'shifts',
    'reports',
    'product_analytics',
    'promotions',
    'staff_users',
    'staff_roles',
    'users',
    'settings_receipt',
    'settings_taxes',
    'settings_payment',
    'settings_channels',
    'settings_loyalty',
    'outlets',
    'guide',
  ],
};

const DEFAULT_TAB: Record<UserRole, TabKey> = {
  CASHIER: 'pos',
  WAREHOUSE: 'inventory',
  SUPERVISOR: 'overview',
  ADMIN: 'overview',
  OWNER: 'overview',
};

export const DashboardPage: React.FC<DashboardPageProps> = ({ user, onLogout, onUserChange: _onUserChange }) => {
  // Dukungan URL query param ?tab=xxx untuk deep linking dan navigasi instan
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) return tabParam as TabKey;
    }
    return DEFAULT_TAB[user.role] || 'pos';
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && activeTab) {
      const url = new URL(window.location.href);
      if (url.searchParams.get('tab') !== activeTab) {
        url.searchParams.set('tab', activeTab);
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [activeTab]);
  const [healthStatus, setHealthStatus] = useState<'checking' | 'ok' | 'error'>('checking');
  const [productCount, setProductCount] = useState<number>(8);
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [bluetoothModalOpen, setBluetoothModalOpen] = useState(false);

  // Multi-Outlet Management State (PRO Multi-Branch Architecture)
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [activeOutlet, setActiveOutlet] = useState<Outlet | null>(null);
  const [appendOrderData, setAppendOrderData] = useState<Order | null>(null);
  const [selectedQrOrderForPos, setSelectedQrOrderForPos] = useState<QrLiveOrder | null>(null);
  const [loadingOutlets, setLoadingOutlets] = useState(true);
  const [guideSection, setGuideSection] = useState<string>('onboarding');

  const handleOpenGuide = (sectionId?: string) => {
    if (sectionId) setGuideSection(sectionId);
    setActiveTab('guide');
  };

  // Fetch all outlets belonging to this store's tenant
  const fetchOutlets = async () => {
    try {
      setLoadingOutlets(true);
      const res = await api.getOutlets();
      if (res.status === 'success' && res.data) {
        setOutlets(res.data);
        if (res.data.length > 0) {
          setActiveOutlet((current) => {
            // Kasir & Gudang harus terkunci ke outlet penugasan mereka
            if (user.role === 'CASHIER' || user.role === 'WAREHOUSE') {
              const userOutlet = res.data.find((o: Outlet) => o.id === user.outletId || o.id === user.outlet?.id);
              if (userOutlet) return userOutlet;
            }

            // Jika outlet yang saat ini aktif valid dan BUKAN gudang, pertahankan
            if (current && !current.isWarehouse) {
              const found = res.data.find((o: Outlet) => o.id === current.id && !o.isWarehouse);
              if (found) return found;
            }

            // Prioritas: Toko penjualan yang cocok dengan penugasan outlet user
            const matchedStore = res.data.find(
              (o: Outlet) => !o.isWarehouse && (o.id === user.outletId || o.id === user.outlet?.id)
            );
            if (matchedStore) return matchedStore;

            // Prioritas fallback: Ambil Toko Penjualan pertama (bukan Gudang)
            const firstStore = res.data.find((o: Outlet) => !o.isWarehouse);
            return firstStore || res.data[0];
          });
        } else {
          setActiveOutlet(null);
        }
      }
    } catch (err) {
      console.error('Gagal mengambil daftar outlet:', err);
    } finally {
      setLoadingOutlets(false);
    }
  };

  useEffect(() => {
    fetchOutlets();
  }, [user.id, user.tenantId, user.outletId, user.role]);

  const handleOutletSelect = (outletId: string) => {
    const selected = outlets.find((o) => o.id === outletId);
    if (selected) {
      setActiveOutlet(selected);
      if (selected.isWarehouse) {
        const allowedWarehouseTabs: TabKey[] = [
          'inventory',
          'stock_movements',
          'purchase_orders',
          'transfers',
          'suppliers',
          'recipes',
          'products',
          'staff_users',
          'staff_roles',
          'users',
          'outlets',
          'guide',
        ];
        if (!allowedWarehouseTabs.includes(activeTab)) {
          setActiveTab('inventory');
        }
      }
    }
  };

  const handleUpdateOutletFees = (updatedFees: OutletFee[]) => {
    if (!activeOutlet) return;
    const updated = { ...activeOutlet, feesConfig: updatedFees };
    setActiveOutlet(updated);
    setOutlets((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
  };

  const handleOutletUpdated = (updatedOutlet: Outlet) => {
    setActiveOutlet(updatedOutlet);
    setOutlets((prev) => prev.map((o) => (o.id === updatedOutlet.id ? updatedOutlet : o)));
  };

  // Sesuaikan tab aktif bila user switch role atau outlet gudang aktif
  useEffect(() => {
    if (activeOutlet?.isWarehouse) {
      const allowedWarehouseTabs: TabKey[] = [
        'inventory',
        'stock_movements',
        'purchase_orders',
        'transfers',
        'suppliers',
        'recipes',
        'products',
        'staff_users',
        'staff_roles',
        'users',
        'outlets',
        'guide',
      ];
      if (!allowedWarehouseTabs.includes(activeTab)) {
        setActiveTab('inventory');
      }
      return;
    }

    const allowed = ROLE_TABS[user.role] || ['pos'];
    if (!allowed.includes(activeTab)) {
      setActiveTab(DEFAULT_TAB[user.role] || allowed[0]);
    }
  }, [user.role, activeOutlet?.id, activeOutlet?.isWarehouse, activeTab]);

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
        }
      })
      .catch(() => {});

    // Otomatis buka wizard untuk Admin/Owner bila toko baru belum melengkapi profil/kontak
    if ((!activeOutlet.address || activeOutlet.address.includes('Setup di Onboarding') || !activeOutlet.phone) && (user.role === 'ADMIN' || (user as any).role === 'OWNER')) {
      setShowOnboardingWizard(true);
    }
  }, [activeOutlet?.id]);

  // Perhitungan Checklist Setup Awal (0 - 100% dengan 3 Langkah Terstruktur)
  const hasStep1Address = Boolean(activeOutlet?.address && activeOutlet?.phone && !activeOutlet?.address?.includes('Setup di Onboarding'));
  const hasStep2Receipt = Boolean(activeOutlet?.receiptConfig?.paperSize);
  const hasStep3Staff = usersList.some((u) => u.role === 'CASHIER' || u.role === 'SUPERVISOR') || (activeOutlet?._count?.users ?? 0) > 1;

  const completedStepsCount =
    (hasStep1Address ? 1 : 0) +
    (hasStep2Receipt ? 1 : 0) +
    (hasStep3Staff ? 1 : 0);
  const setupPercent = Math.round((completedStepsCount / 3) * 100);
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

  // Hanya Admin & Supervisor yang berhak berpindah toko (Multi-Outlet Switcher)
  const canSwitchOutlet = user.role === 'ADMIN' || user.role === 'SUPERVISOR';

  // 1. Full-Screen Wizard bila Owner belum memiliki toko
  if (!loadingOutlets && outlets.length === 0 && (user.role === 'ADMIN' || (user as any).role === 'OWNER')) {
    return (
      <FullScreenStoreWizard
        ownerName={user.name}
        ownerEmail={user.email}
        onStoreCreated={async () => {
          await fetchOutlets();
          setActiveTab('overview');
        }}
        onLogout={onLogout}
      />
    );
  }

  // 2. Enterprise Well POS Backoffice untuk Owner / Admin / Supervisor
  if (user.role === 'ADMIN' || (user as any).role === 'OWNER' || user.role === 'SUPERVISOR') {
    return (
      <BackofficeLayout
        user={user}
        outlets={outlets}
        activeOutlet={activeOutlet}
        onSelectOutlet={handleOutletSelect}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        onOpenGuide={handleOpenGuide}
        onLogout={onLogout}
      >
        {activeTab === 'pos' ? (
          <PosTerminalView
            activeOutlet={activeOutlet}
            currentUserRole={user.role}
            currentUser={user}
            onOutletFeesUpdated={handleUpdateOutletFees}
            appendOrderData={appendOrderData}
            onClearAppendOrder={() => setAppendOrderData(null)}
            loadQrOrderData={selectedQrOrderForPos}
            onClearLoadQrOrder={() => setSelectedQrOrderForPos(null)}
            onNavigateTab={(tab) => setActiveTab(tab as TabKey)}
            onLogout={onLogout}
            allowedTabs={allowedTabs}
          />
        ) : activeTab === 'overview' ? (
          <BusinessSummaryView
            activeOutlet={activeOutlet}
            onOpenPos={() => setActiveTab('pos')}
          />
        ) : activeTab === 'billing_tokens' ? (
          <BillingTokensView
            user={user}
            activeOutlet={activeOutlet}
          />
        ) : activeTab === 'products' ? (
          <ProductsView
            userRole={user.role}
            outletId={activeOutlet?.id}
            onProductCountChange={(count) => setProductCount(count)}
            onNavigateToCategories={() => setActiveTab('categories')}
          />
        ) : activeTab === 'categories' ? (
          <CategoriesView
            activeOutlet={activeOutlet}
            onNavigateToProductsWithCategory={() => setActiveTab('products')}
          />
        ) : activeTab === 'modifiers' ? (
          <ModifiersView />
        ) : activeTab === 'recipes' ? (
          <RecipesView outletId={activeOutlet?.id} />
        ) : activeTab === 'qr_tables' ? (
          <QrTablesView activeOutlet={activeOutlet} />
        ) : activeTab === 'qr_settings' ? (
          <QrMenuSettingsView activeOutlet={activeOutlet} />
        ) : activeTab === 'qr_orders' ? (
          <QrLiveOrdersView
            activeOutlet={activeOutlet}
            onOpenInPos={(order) => {
              setSelectedQrOrderForPos(order);
              setActiveTab('pos');
            }}
          />
        ) : activeTab === 'qr_guest_menu' ? (
          <div className="space-y-0">
            {/* 2-Col: Info Panel + Phone Mockup */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">

              {/* Kiri: Info Panel */}
              <div className="w-full lg:w-80 shrink-0 space-y-4">
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Smartphone className="w-4 h-4 text-blue-900 shrink-0" />
                      <h2 className="text-sm font-black text-slate-900">Pratinjau Menu Tamu</h2>
                    </div>
                    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-900 text-[11px] font-bold border border-blue-200 mb-2">
                      Toko: {activeOutlet?.name || 'Utama'}
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Tampilan persis yang dilihat tamu saat memindai QR meja restoran.
                    </p>
                  </div>

                  <a
                    href={`/#menu?outletId=${activeOutlet?.id || ''}&table=DEMO`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full px-4 py-2.5 bg-blue-900 hover:bg-blue-800 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-900/20 active:scale-95 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Buka Layar Penuh di Tab Baru</span>
                  </a>
                </div>

                {/* Tips */}
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2">
                  <p className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider">💡 Tips</p>
                  <ul className="text-xs text-amber-900 space-y-1.5 leading-relaxed">
                    <li>• Scan QR meja untuk membuka tampilan asli di HP tamu</li>
                    <li>• Klik "Buka Layar Penuh" untuk menguji di browser HP</li>
                    <li>• Pratinjau di sini menggunakan <strong>Meja DEMO</strong></li>
                  </ul>
                </div>
              </div>

              {/* Kanan: Phone Mockup */}
              <div className="flex-1 flex justify-center lg:justify-start items-start">
                <div className="w-full max-w-[375px] bg-white rounded-[2.5rem] border-[8px] border-slate-900 shadow-2xl overflow-hidden relative">
                  {/* Simulated Phone Notch */}
                  <div className="bg-slate-900 h-6 flex items-center justify-center">
                    <div className="w-24 h-3 bg-slate-950 rounded-full" />
                  </div>

                  {/* Embedded Customer Menu Container (Scroll-only, tanpa banner merah, non-clickable) */}
                  <div className="max-h-[680px] overflow-y-auto select-none cursor-default">
                    <div className="pointer-events-none">
                      <CustomerQrMenuView
                        outletId={activeOutlet?.id || ''}
                        tableCode="DEMO"
                        hidePreviewBanner
                      />
                    </div>
                  </div>

                  {/* Bottom bar notch */}
                  <div className="bg-slate-900 h-5 flex items-center justify-center">
                    <div className="w-28 h-1 bg-slate-700 rounded-full" />
                  </div>
                </div>
              </div>

            </div>
          </div>
        ) : activeTab === 'inventory' ? (
          <InventoryView activeOutlet={activeOutlet} />
        ) : activeTab === 'stock_movements' ? (
          <InventoryView
            activeOutlet={activeOutlet}
            initialTab="PRODUCTS"
            initialSubView="MOVEMENTS"
          />
        ) : activeTab === 'purchase_orders' ? (
          <PurchaseOrdersView activeOutlet={activeOutlet} />
        ) : activeTab === 'transfers' ? (
          <StockTransfersView activeOutlet={activeOutlet} />
        ) : activeTab === 'suppliers' ? (
          <SuppliersView />
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
          <ShiftsAuditView activeOutlet={activeOutlet} />
        ) : activeTab === 'reports' ? (
          <FinancialReportView activeOutlet={activeOutlet} />
        ) : activeTab === 'product_analytics' ? (
          <ProductAnalyticsView activeOutlet={activeOutlet} />
        ) : activeTab === 'promotions' ? (
          <PromotionsView />
        ) : activeTab === 'staff_users' || activeTab === 'users' ? (
          <UsersView onNavigateToRoles={() => setActiveTab('staff_roles')} />
        ) : activeTab === 'staff_roles' ? (
          <StaffRolesView onBackToStaffList={() => setActiveTab('staff_users')} />
        ) : activeTab === 'settings_receipt' ? (
          <ReceiptSettingsView
            activeOutlet={activeOutlet}
            onOutletUpdated={handleOutletUpdated}
          />
        ) : activeTab === 'settings_taxes' ? (
          <TaxesSettingsView
            activeOutlet={activeOutlet}
            onOutletUpdated={handleOutletUpdated}
            currentUserRole={user.role}
          />
        ) : activeTab === 'settings_payment' ? (
          <PaymentSettingsView
            activeOutlet={activeOutlet}
            onOutletUpdated={handleOutletUpdated}
            currentUserRole={user.role}
          />
        ) : activeTab === 'settings_channels' ? (
          <SalesChannelsSettingsView
            activeOutlet={activeOutlet}
            onOutletUpdated={handleOutletUpdated}
            currentUserRole={user.role}
          />
        ) : activeTab === 'settings_loyalty' ? (
          <LoyaltySettingsView
            activeOutlet={activeOutlet}
            onOutletUpdated={handleOutletUpdated}
          />
        ) : activeTab === 'outlets' ? (
          <OutletsView
            activeOutletId={activeOutlet?.id}
            onSelectActiveOutlet={(id) => {
              handleOutletSelect(id);
            }}
            onOutletsUpdated={fetchOutlets}
          />
        ) : activeTab === 'guide' ? (
          <UserGuideView
            initialSection={guideSection}
            onNavigateTab={(tab) => {
              setActiveTab(tab as TabKey);
            }}
            currentUserRole={user.role}
          />
        ) : (
          <InventoryView activeOutlet={activeOutlet} />
        )}

        {/* Modal Onboarding Wizard (3 Steps) */}
        {showOnboardingWizard && activeOutlet && (
          <OnboardingWizardModal
            isOpen={showOnboardingWizard}
            onClose={() => setShowOnboardingWizard(false)}
            outletId={activeOutlet.id}
            businessName={user.tenant?.name || (user as any).businessName || activeOutlet.name}
            currentUser={user}
            onComplete={() => {
              setShowOnboardingWizard(false);
              fetchOutlets();
            }}
          />
        )}
      </BackofficeLayout>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Mobile Navigation Drawer (Burger Menu Kasir & Gudang di Smartphone) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex justify-start bg-slate-900/60 backdrop-blur-2xs animate-in fade-in duration-150 md:hidden">
          <div
            className="bg-white w-[290px] h-full shadow-2xl flex flex-col justify-between p-4 animate-in slide-in-from-left duration-200"
            style={{
              paddingTop: 'max(14px, env(safe-area-inset-top, 0px))',
              paddingBottom: 'max(14px, env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div className="space-y-4 overflow-y-auto max-h-[calc(100vh-100px)] pr-1">
              {/* Header Drawer */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                    {activeOutlet?.name?.charAt(0).toUpperCase() || 'W'}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-black text-xs text-blue-950 truncate">
                      {activeOutlet?.name || 'Well POS'}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-semibold truncate">
                      {user.name} • {badge.label}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Daftar Menu Navigasi Sesuai Role */}
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-1">
                  Menu Utama
                </span>

                {/* Tab POS Kasir */}
                {allowedTabs.includes('pos') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('pos');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                      activeTab === 'pos'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Mesin Kasir (POS)</span>
                  </button>
                )}

                {/* Tab Ringkasan Toko */}
                {allowedTabs.includes('overview') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('overview');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                      activeTab === 'overview'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>Ringkasan {user.role === 'WAREHOUSE' ? 'Gudang' : 'Toko'}</span>
                  </button>
                )}

                {/* Tab Katalog Produk */}
                {allowedTabs.includes('products') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('products');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl font-bold text-xs flex items-center justify-between transition-all text-left cursor-pointer ${
                      activeTab === 'products'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <ShoppingBag className="w-4 h-4" />
                      <span>Katalog Produk</span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/60 text-slate-700">
                      {productCount}
                    </span>
                  </button>
                )}

                {/* Tab Stok & Kartu Mutasi */}
                {allowedTabs.includes('inventory') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('inventory');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                      activeTab === 'inventory'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Boxes className="w-4 h-4" />
                    <span>Bahan Baku &amp; Stok</span>
                  </button>
                )}

                {/* Tab Resep & Bahan Baku */}
                {allowedTabs.includes('recipes') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('recipes');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                      activeTab === 'recipes'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <UtensilsCrossed className="w-4 h-4" />
                    <span>Resep &amp; Bahan Baku</span>
                  </button>
                )}

                {/* Tab Kartu Mutasi */}
                {allowedTabs.includes('stock_movements') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('stock_movements');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                      activeTab === 'stock_movements'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <ClipboardList className="w-4 h-4" />
                    <span>Kartu Mutasi Stok</span>
                  </button>
                )}

                {/* Tab Pengadaan (PO) */}
                {allowedTabs.includes('purchase_orders') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('purchase_orders');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                      activeTab === 'purchase_orders'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Pengadaan (PO)</span>
                  </button>
                )}

                {/* Tab Transfer Antar Cabang */}
                {allowedTabs.includes('transfers') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('transfers');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                      activeTab === 'transfers'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <ArrowLeftRight className="w-4 h-4" />
                    <span>Transfer Antar Cabang</span>
                  </button>
                )}

                {/* Tab Pemasok / Vendor */}
                {allowedTabs.includes('suppliers') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('suppliers');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                      activeTab === 'suppliers'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Contact className="w-4 h-4" />
                    <span>Pemasok (Vendor)</span>
                  </button>
                )}

                {/* Tab Riwayat Transaksi */}
                {allowedTabs.includes('orders') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('orders');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                      activeTab === 'orders'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Receipt className="w-4 h-4" />
                    <span>Riwayat Transaksi</span>
                  </button>
                )}

                {/* Tab Pesanan QR Meja */}
                {allowedTabs.includes('qr_orders') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('qr_orders');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                      activeTab === 'qr_orders'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Ticket className="w-4 h-4" />
                    <span>Pesanan QR Meja</span>
                  </button>
                )}

                {/* Tab Pelanggan & Member */}
                {allowedTabs.includes('customers') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('customers');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                      activeTab === 'customers'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Pelanggan &amp; Member</span>
                  </button>
                )}

                {/* Tab Laporan Shift Kasir */}
                {allowedTabs.includes('shifts') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('shifts');
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full p-2.5 rounded-xl font-bold text-xs flex items-center gap-2.5 transition-all text-left cursor-pointer ${
                      activeTab === 'shifts'
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Clock className="w-4 h-4" />
                    <span>Laporan Shift Kasir</span>
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Actions Drawer: Printer Bluetooth, Pasang PWA, PIN Lock & Logout */}
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setBluetoothModalOpen(true);
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-blue-50/80 hover:bg-blue-100 text-blue-900 border border-blue-200/80 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Bluetooth className="w-4 h-4 text-blue-700" />
                <span>Pengaturan Printer Bluetooth</span>
              </button>

              <PwaInstallButton className="w-full justify-center" />

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Lock className="w-4 h-4 text-amber-700" />
                <span>Kunci Terminal Kasir</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLogout();
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <LogOut className="w-4 h-4 text-rose-600" />
                <span>Keluar Akun</span>
              </button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Top Header Navigation */}
      <header
        className={`border-b border-slate-200 bg-white sticky top-0 z-20 px-3 sm:px-8 py-2.5 sm:py-3 items-center justify-between shadow-xs ${activeTab === 'pos' ? 'hidden md:flex' : 'flex'}`}
        style={{ paddingTop: 'calc(max(env(safe-area-inset-top, 0px), 48px) + 8px)' }}
      >
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1 mr-2">
          {/* Tombol Hamburger Menu Mobile untuk Navigasi */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden p-1.5 rounded-xl bg-blue-50 text-blue-900 border border-blue-200 hover:bg-blue-100 transition-all shrink-0 cursor-pointer shadow-xs"
            title="Buka Menu Navigasi"
          >
            <Menu className="w-4 h-4 stroke-[2.5]" />
          </button>

          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-900/20 shrink-0">
            <Store className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <h1 className="text-sm sm:text-base font-extrabold text-blue-950 tracking-tight truncate">
                <span>{activeOutlet?.name || user.outlet?.name || user.tenant?.name || 'Well POS'}</span>
              </h1>
              {/* Multi-Outlet Dropdown Selector & Manage Shortcut:
                  - Kasir & Gudang: Terkunci pada toko penugasan (Badge tetap)
                  - Admin & SPV: Memiliki wewenang dropdown switcher & shortcut kelola toko */}
              {canSwitchOutlet && outlets.length > 1 ? (
                <div className="relative inline-flex items-center gap-1.5 shrink-0">
                  <select
                    value={activeOutlet?.id || ''}
                    onChange={(e) => handleOutletSelect(e.target.value)}
                    className="bg-blue-50 border border-blue-300 text-blue-950 text-xs font-black rounded-lg px-2 py-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-xs hover:bg-blue-100 transition-colors"
                    title="Ganti Toko Aktif (Akses Khusus Admin / Supervisor)"
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
                      className="px-2 py-0.5 text-[11px] font-bold bg-slate-100 hover:bg-blue-100 hover:text-blue-900 text-slate-700 border border-slate-300 rounded-lg flex items-center gap-1 transition-all shadow-xs"
                      title="Buka Menu Kelola Toko"
                    >
                      <Store className="w-3 h-3 text-blue-900" />
                      <span className="hidden sm:inline">Kelola Toko</span>
                    </button>
                  )}
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200/80 shrink-0">
                  <Lock className="w-2.5 h-2.5 text-blue-700" />
                  <span>Terkunci</span>
                </span>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate max-w-[200px] xs:max-w-[260px] sm:max-w-md">
              {activeOutlet?.address || user.outlet?.address || 'Alamat toko belum diatur'}
            </p>
          </div>
        </div>

        {/* User Profile & Logout */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {/* Tombol Pengaturan Printer Bluetooth Kasir */}
          <button
            type="button"
            onClick={() => setBluetoothModalOpen(true)}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 transition-all font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
            title="Pengaturan & Tes Printer Bluetooth Thermal"
          >
            <Bluetooth className="w-3.5 h-3.5 text-blue-700" />
            <span className="hidden md:inline">Printer BT</span>
          </button>

          <PwaInstallButton />

          <div className="hidden sm:flex flex-col text-right">
            <span className="text-sm font-bold text-slate-800">{user.name}</span>
            <span className="text-xs text-slate-500">{user.email}</span>
          </div>

          <span
            className={`text-[10px] sm:text-xs px-2.5 sm:px-3 py-1 rounded-full border font-bold shrink-0 ${badge.color}`}
          >
            {badge.label}
          </span>

          <button
            onClick={onLogout}
            title="Kunci Layar Terminal Kasir (PIN Lock)"
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 transition-all font-bold text-xs flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0"
          >
            <Lock className="w-3.5 h-3.5 text-amber-700" />
            <span className="hidden sm:inline">Kunci Terminal</span>
          </button>

          <button
            onClick={onLogout}
            title="Keluar Akun"
            className="p-1.5 sm:p-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 border border-slate-200 transition-all text-slate-600 shadow-xs cursor-pointer shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Subnav Navigation Tabs (Filtered strictly by Role) - Disembunyikan di Mobile, Tampil di Desktop (md ke atas) */}
      <div className="hidden md:block bg-white border-b border-slate-200 px-4 sm:px-8 py-2 sticky top-[61px] lg:top-[65px] z-10 shadow-sm">
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

          {/* Tab Pengadaan (PO) */}
          {allowedTabs.includes('purchase_orders') && (
            <button
              onClick={() => setActiveTab('purchase_orders')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'purchase_orders'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-blue-950 hover:bg-slate-100'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Pengadaan (PO)</span>
            </button>
          )}

          {/* Tab Transfer Cabang */}
          {allowedTabs.includes('transfers') && (
            <button
              onClick={() => setActiveTab('transfers')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 shrink-0 ${
                activeTab === 'transfers'
                  ? 'bg-blue-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-blue-950 hover:bg-slate-100'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span>Transfer Cabang</span>
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

          {/* Tab Kelola Outlet Toko (Multi-Outlet PRO) */}
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
              <span>Outlet Toko</span>
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
      <main className={`flex-1 w-full mx-auto ${
        activeTab === 'pos' ? 'max-w-[1600px] p-0 sm:p-3' : 'max-w-6xl p-4 sm:p-8'
      }`}>
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

            {/* Checklist Grid (3 Langkah Terstruktur) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
                    <span>1. Profil &amp; WA Toko</span>
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
                  hasStep2Receipt
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-extrabold flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5" />
                    <span>2. Ukuran Struk</span>
                  </span>
                  {hasStep2Receipt ? (
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
                  {hasStep2Receipt
                    ? `Default printer outlet: ${activeOutlet?.receiptConfig?.paperSize}`
                    : 'Pilih standar printer kasir (58mm / 80mm)'}
                </p>
              </div>

              {/* Item 3 */}
              <div
                className={`p-3 rounded-2xl border transition-all ${
                  hasStep3Staff
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/20'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-extrabold flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" />
                    <span>3. Akun SPV &amp; Kasir</span>
                  </span>
                  {hasStep3Staff ? (
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
                  {hasStep3Staff
                    ? 'Akun supervisor & kasir siap bertransaksi'
                    : 'Siapkan akun operasional counter kasir'}
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'pos' ? (
          <PosTerminalView
            activeOutlet={activeOutlet}
            currentUserRole={user.role}
            currentUser={user}
            onOutletFeesUpdated={handleUpdateOutletFees}
            appendOrderData={appendOrderData}
            onClearAppendOrder={() => setAppendOrderData(null)}
            loadQrOrderData={selectedQrOrderForPos}
            onClearLoadQrOrder={() => setSelectedQrOrderForPos(null)}
            onNavigateTab={(tab) => setActiveTab(tab as TabKey)}
            onLogout={onLogout}
            allowedTabs={allowedTabs}
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
                      <span>Kelola Toko ({outlets.filter((o) => !o.isWarehouse).length})</span>
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
                title={allowedTabs.includes('outlets') ? 'Klik untuk kelola outlet toko' : undefined}
              >
                <div className="flex items-center justify-between text-slate-500 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider">Outlet Toko</span>
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
                    Akses Hanya Lihat (Read-Only)
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
                      onClick={() => setActiveTab('purchase_orders')}
                      className="p-6 rounded-2xl bg-white border-2 border-blue-900 shadow-md flex flex-col justify-between cursor-pointer hover:scale-[1.01] transition-all"
                    >
                      <div>
                        <div className="w-10 h-10 rounded-xl bg-blue-900 text-white flex items-center justify-center mb-3 font-bold">
                          1
                        </div>
                        <h4 className="font-bold text-blue-950 text-base">Pengadaan Barang (PO)</h4>
                        <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                          Terima pasokan bahan baku dari supplier, cetak PO, dan verifikasi penerimaan fisik dengan update Moving Average Cost otomatis.
                        </p>
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 text-xs text-blue-900 font-extrabold flex items-center justify-between">
                        <span>Buka Pengadaan PO</span>
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
            onNavigateToCategories={() => setActiveTab('categories')}
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
          <ShiftsAuditView activeOutlet={activeOutlet} />
        ) : activeTab === 'reports' ? (
          <FinancialReportView activeOutlet={activeOutlet} />
        ) : activeTab === 'users' ? (
          <UsersView onNavigateToRoles={() => setActiveTab('staff_roles')} />
        ) : activeTab === 'outlets' ? (
          <OutletsView
            activeOutletId={activeOutlet?.id}
            onSelectActiveOutlet={(id) => {
              handleOutletSelect(id);
            }}
            onOutletsUpdated={fetchOutlets}
          />
        ) : activeTab === 'guide' ? (
          <div className="max-w-6xl mx-auto p-4 sm:p-6">
            <UserGuideView
              initialSection={guideSection}
              onNavigateTab={(tab) => setActiveTab(tab as TabKey)}
              currentUserRole={user.role}
            />
          </div>
        ) : (
          <InventoryView activeOutlet={activeOutlet} />
        )}

        {/* Modal Onboarding Wizard (3 Steps) */}
        {showOnboardingWizard && activeOutlet && (
          <OnboardingWizardModal
            isOpen={showOnboardingWizard}
            onClose={() => setShowOnboardingWizard(false)}
            outletId={activeOutlet.id}
            businessName={user.tenant?.name || (user as any).businessName || activeOutlet.name}
            currentUser={user}
            onComplete={() => {
              setShowOnboardingWizard(false);
              fetchOutlets();
              window.location.reload();
            }}
          />
        )}

        {/* Modal Pengaturan Printer Bluetooth Kasir */}
        <BluetoothSettingsModal
          isOpen={bluetoothModalOpen}
          onClose={() => setBluetoothModalOpen(false)}
        />
      </main>
    </div>
  );
};
