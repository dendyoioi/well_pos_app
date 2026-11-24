// Well POS - PerformanceAnalyticsContainer Component
// Container Orchestrator Analitik Performa Laundry (Global Filter, Level 1 Overview, 9 Lazy Sub-Tabs, 1 Drawer)

import React, { useState, useEffect, Suspense, useCallback, useMemo } from 'react';
import {
  DollarSign,
  ShoppingBag,
  Users,
  Activity,
  Award,
  Cpu,
  Package,
  Store,
  Bot,
  Plus,
  Layers,
  MessageSquare,
} from 'lucide-react';
import type { Outlet } from '../../../types/outlet';
import type { User } from '../../../types/auth';
import type { ExecutiveOverviewResult, DrilldownType } from '../../../types/laundryAnalytics';
import { fetchLaundryOverview } from '../../../services/laundryAnalyticsApi';
import { useAnalyticsFilter } from './useAnalyticsFilter';
import { GlobalAnalyticsFilterBar } from './GlobalAnalyticsFilterBar';
import { ExecutiveOverviewLevel1 } from './ExecutiveOverviewLevel1';
import { DrillDownInspectionDrawer } from './DrillDownInspectionDrawer';

// Lazy-loaded 9 Sub-Tabs for optimal code-splitting
const FinancialAnalyticsTab = React.lazy(() =>
  import('./tabs/FinancialAnalyticsTab').then((m) => ({ default: m.FinancialAnalyticsTab }))
);
const SalesAnalyticsTab = React.lazy(() =>
  import('./tabs/SalesAnalyticsTab').then((m) => ({ default: m.SalesAnalyticsTab }))
);
const CustomerAnalyticsTab = React.lazy(() =>
  import('./tabs/CustomerAnalyticsTab').then((m) => ({ default: m.CustomerAnalyticsTab }))
);
const OperationalAnalyticsTab = React.lazy(() =>
  import('./tabs/OperationalAnalyticsTab').then((m) => ({ default: m.OperationalAnalyticsTab }))
);
const InventoryCostAnalyticsTab = React.lazy(() =>
  import('./tabs/InventoryCostAnalyticsTab').then((m) => ({ default: m.InventoryCostAnalyticsTab }))
);
const EmployeeAnalyticsTab = React.lazy(() =>
  import('./tabs/EmployeeAnalyticsTab').then((m) => ({ default: m.EmployeeAnalyticsTab }))
);
const MachineAnalyticsTab = React.lazy(() =>
  import('./tabs/MachineAnalyticsTab').then((m) => ({ default: m.MachineAnalyticsTab }))
);
const MultiOutletBenchmarkTab = React.lazy(() =>
  import('./tabs/MultiOutletBenchmarkTab').then((m) => ({ default: m.MultiOutletBenchmarkTab }))
);
const AiAssistantTab = React.lazy(() =>
  import('./tabs/AiAssistantTab').then((m) => ({ default: m.AiAssistantTab }))
);

interface PerformanceAnalyticsContainerProps {
  activeOutlet?: Outlet | null;
  currentUser?: User;
  onOpenPos?: () => void;
  onNavigateTab?: (tabKey: string) => void;
  onOpenFeedbackModal?: () => void;
}

interface DrawerState {
  isOpen: boolean;
  type: DrilldownType;
  contextParams?: any;
}

export const PerformanceAnalyticsContainer: React.FC<PerformanceAnalyticsContainerProps> = ({
  activeOutlet,
  currentUser: _currentUser,
  onOpenPos,
  onNavigateTab,
  onOpenFeedbackModal,
}) => {
  const filter = useAnalyticsFilter(activeOutlet);
  const {
    preset,
    startDate,
    endDate,
    outletId,
    activeSubTab,
    isOwner,
    canSwitchOutlet,
    userRole,
    dateError,
    setPreset,
    setCustomDateRange,
    setOutletId,
    setActiveSubTab,
    getAbortSignal,
  } = filter;

  // Overview Data State
  const [overviewData, setOverviewData] = useState<ExecutiveOverviewResult | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Single Drawer Inspection State (Zero Stacked Modals Policy)
  const [drawerState, setDrawerState] = useState<DrawerState>({
    isOpen: false,
    type: 'ORDERS_BY_DATE',
    contextParams: undefined,
  });

  const handleOpenDrilldown = useCallback((type: DrilldownType, context?: any) => {
    setDrawerState({
      isOpen: true,
      type,
      contextParams: context,
    });
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Fetch Overview Level 1
  const loadOverview = useCallback(() => {
    const signal = getAbortSignal();
    setOverviewLoading(true);
    setOverviewError(null);

    fetchLaundryOverview(
      {
        preset,
        startDate,
        endDate,
        outletId,
      },
      signal
    )
      .then((res) => {
        setOverviewData(res);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setOverviewError(err.message || 'Gagal memuat overview analitik.');
      })
      .finally(() => {
        setOverviewLoading(false);
      });
  }, [preset, startDate, endDate, outletId, getAbortSignal]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  // Dengarkan event order baru dari kasir laundry
  useEffect(() => {
    const handleOrderEvent = () => {
      if (document.hidden) return; // Lindungi kuota CDN Vercel
      loadOverview();
    };
    window.addEventListener('wellpos:laundry_order_created', handleOrderEvent);
    return () => window.removeEventListener('wellpos:laundry_order_created', handleOrderEvent);
  }, [loadOverview]);

  // Handler Aksi Peringatan / Alert Center Navigation
  const handleAlertAction = useCallback(
    (actionTarget: string) => {
      if (!actionTarget) return;

      // Kasus khusus drilldown piutang
      if (actionTarget.includes('debts') || actionTarget.includes('UNPAID_DEBTS')) {
        handleOpenDrilldown('UNPAID_DEBTS');
        return;
      }

      // Kasus khusus order terlambat / overdue
      if (actionTarget.includes('overdue') || actionTarget.includes('PROCESSING')) {
        handleOpenDrilldown('OVERDUE_ORDERS');
        return;
      }

      // Navigasi sub-tab internal
      if (actionTarget.includes('tab=')) {
        const match = actionTarget.match(/tab=([^&]+)/);
        if (match && match[1]) {
          setActiveSubTab(match[1]);
          return;
        }
      }

      // Navigasi tab modul lain
      if (actionTarget.includes('laundry_queue')) {
        onNavigateTab?.('laundry_queue');
        return;
      }
      if (actionTarget.includes('inventory')) {
        setActiveSubTab('inventory');
        return;
      }
    },
    [handleOpenDrilldown, setActiveSubTab, onNavigateTab]
  );

  // Sub-Tabs Roster & RBAC Visibility
  const availableSubTabs = useMemo(() => {
    const isSpv = userRole === 'SUPERVISOR';
    const isAdm = userRole === 'ADMIN';

    // SUPERVISOR: 4 Sub-Tab Operasional Murni
    if (isSpv) {
      return [
        { id: 'operations', label: 'Operasional & SLA', icon: Activity },
        { id: 'employees', label: 'Karyawan & Shift', icon: Award },
        { id: 'machines', label: 'Mesin & Aset', icon: Cpu },
        { id: 'inventory', label: 'Bahan Baku & Stok', icon: Package },
      ];
    }

    // ADMIN: 8 Sub-Tab (Tanpa Benchmark Multi-Outlet)
    if (isAdm) {
      return [
        { id: 'financial', label: 'Finansial & Kas', icon: DollarSign },
        { id: 'sales', label: 'Penjualan & Layanan', icon: ShoppingBag },
        { id: 'customers', label: 'Pelanggan & Retensi', icon: Users },
        { id: 'operations', label: 'Operasional & SLA', icon: Activity },
        { id: 'employees', label: 'Karyawan & Shift', icon: Award },
        { id: 'machines', label: 'Mesin & Aset', icon: Cpu },
        { id: 'inventory', label: 'Biaya Bahan & Stok', icon: Package },
        { id: 'ai', label: 'Asisten AI', icon: Bot },
      ];
    }

    // OWNER: 9 Sub-Tab Lengkap
    return [
      { id: 'financial', label: 'Finansial & Kas', icon: DollarSign },
      { id: 'sales', label: 'Penjualan & Layanan', icon: ShoppingBag },
      { id: 'customers', label: 'Pelanggan & Retensi', icon: Users },
      { id: 'operations', label: 'Operasional & SLA', icon: Activity },
      { id: 'employees', label: 'Karyawan & Shift', icon: Award },
      { id: 'machines', label: 'Mesin & Aset', icon: Cpu },
      { id: 'inventory', label: 'Biaya Bahan & Stok', icon: Package },
      { id: 'benchmark', label: 'Benchmark Outlet', icon: Store },
      { id: 'ai', label: 'Asisten AI', icon: Bot },
    ];
  }, [userRole]);

  // RBAC Sub-Tab Guard: validasi activeSubTab terhadap availableSubTabs
  const effectiveSubTab = useMemo(() => {
    const isAllowed = availableSubTabs.some((tab) => tab.id === activeSubTab);
    if (!isAllowed) {
      return availableSubTabs[0]?.id || 'operations';
    }
    return activeSubTab;
  }, [activeSubTab, availableSubTabs]);

  // Otomatis sinkronkan URL jika activeSubTab dari URL query tidak diizinkan untuk role ini
  useEffect(() => {
    if (effectiveSubTab !== activeSubTab) {
      setActiveSubTab(effectiveSubTab);
    }
  }, [effectiveSubTab, activeSubTab, setActiveSubTab]);

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar & Quick Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Performa Bisnis Laundry</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
              Intelligence
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pemantauan holistik keuangan, produksi 11 stase, mesin, kepuasan, dan rekomendasi AI.
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {onOpenPos && (
            <button
              type="button"
              onClick={onOpenPos}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Kasir POS</span>
            </button>
          )}

          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab('laundry_queue')}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors shadow-2xs"
            >
              <Layers className="w-4 h-4 text-blue-900" />
              <span>Antrean Kerja</span>
            </button>
          )}

          {onOpenFeedbackModal && (
            <button
              type="button"
              onClick={onOpenFeedbackModal}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors shadow-2xs"
            >
              <MessageSquare className="w-4 h-4 text-amber-500" />
              <span>Ulasan</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Global Filter Bar (Preset Tanggal, Custom Range, Outlet Selector) */}
      <GlobalAnalyticsFilterBar
        preset={preset}
        startDate={startDate}
        endDate={endDate}
        outletId={outletId}
        isOwner={isOwner}
        canSwitchOutlet={canSwitchOutlet}
        activeOutletName={activeOutlet?.name}
        userRole={userRole}
        dateError={dateError}
        onPresetChange={setPreset}
        onCustomDateChange={setCustomDateRange}
        onOutletChange={setOutletId}
      />

      {/* 3. Executive Overview Level 1 (Hero Health Score, Alert Center, 3 Core Cards) */}
      <ExecutiveOverviewLevel1
        data={overviewData}
        loading={overviewLoading}
        error={overviewError}
        onRetry={loadOverview}
        userRole={userRole}
        onNavigateSubTab={handleAlertAction}
        onOpenDrilldown={(dt) => handleOpenDrilldown(dt as DrilldownType)}
      />

      {/* 4. Sticky Horizontal Pill Sub-Tab Navigation */}
      <div className="sticky top-0 z-20 -mx-4 px-4 sm:mx-0 sm:px-0 py-2 bg-slate-50/95 backdrop-blur-sm border-b border-slate-200/80">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          {availableSubTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = effectiveSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200/80 text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 shadow-2xs'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Render Lazy-Loaded Sub-Tab dengan Suspense */}
      <Suspense
        fallback={
          <div className="py-12 flex flex-col items-center justify-center space-y-3 bg-white border border-slate-200/80 rounded-2xl animate-pulse">
            <div className="w-8 h-8 rounded-full border-2 border-blue-900 border-t-transparent animate-spin" />
            <span className="text-xs font-bold text-slate-500">Memuat Modul Analitik...</span>
          </div>
        }
      >
        {effectiveSubTab === 'financial' && (
          <FinancialAnalyticsTab
            preset={preset}
            startDate={startDate}
            endDate={endDate}
            outletId={outletId}
            isOwner={isOwner}
            userRole={userRole}
            onOpenDrilldown={handleOpenDrilldown}
          />
        )}

        {effectiveSubTab === 'sales' && (
          <SalesAnalyticsTab
            preset={preset}
            startDate={startDate}
            endDate={endDate}
            outletId={outletId}
            onOpenDrilldown={handleOpenDrilldown}
          />
        )}

        {effectiveSubTab === 'customers' && (
          <CustomerAnalyticsTab
            preset={preset}
            startDate={startDate}
            endDate={endDate}
            outletId={outletId}
            onOpenDrilldown={handleOpenDrilldown}
            onOpenFeedbackAudit={onOpenFeedbackModal}
          />
        )}

        {effectiveSubTab === 'operations' && (
          <OperationalAnalyticsTab
            preset={preset}
            startDate={startDate}
            endDate={endDate}
            outletId={outletId}
            userRole={userRole}
            onOpenDrilldown={handleOpenDrilldown}
          />
        )}

        {effectiveSubTab === 'employees' && (
          <EmployeeAnalyticsTab
            preset={preset}
            startDate={startDate}
            endDate={endDate}
            outletId={outletId}
            userRole={userRole}
            onNavigateTab={onNavigateTab}
          />
        )}

        {effectiveSubTab === 'machines' && (
          <MachineAnalyticsTab
            preset={preset}
            startDate={startDate}
            endDate={endDate}
            outletId={outletId}
          />
        )}

        {effectiveSubTab === 'inventory' && (
          <InventoryCostAnalyticsTab
            preset={preset}
            startDate={startDate}
            endDate={endDate}
            outletId={outletId}
            userRole={userRole}
            onNavigateTab={onNavigateTab}
          />
        )}

        {effectiveSubTab === 'benchmark' && isOwner && (
          <MultiOutletBenchmarkTab
            preset={preset}
            startDate={startDate}
            endDate={endDate}
            onSelectOutlet={(oid) => setOutletId(oid)}
          />
        )}

        {effectiveSubTab === 'ai' && (
          <AiAssistantTab
            preset={preset}
            startDate={startDate}
            endDate={endDate}
            outletId={outletId}
            isOwner={isOwner}
            userRole={userRole}
            onAlertAction={handleAlertAction}
          />
        )}
      </Suspense>

      {/* 6. Single DrillDown Inspection Drawer Instance (Zero Stacked Modals Policy) */}
      <DrillDownInspectionDrawer
        isOpen={drawerState.isOpen}
        onClose={handleCloseDrawer}
        type={drawerState.type}
        outletId={outletId}
        preset={preset}
        startDate={startDate}
        endDate={endDate}
        contextParams={drawerState.contextParams}
        userRole={userRole}
      />
    </div>
  );
};
