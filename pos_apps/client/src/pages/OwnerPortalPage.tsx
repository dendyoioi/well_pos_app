import React, { useState, useEffect, useCallback } from 'react';
import {
  Store,
  Zap,
  Receipt,
  Plus,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Ban,
  UtensilsCrossed,
  ShoppingBag,
  Shirt,
  Sparkles,
  LogOut,
  Edit2,
  Tag,
  QrCode,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import type { User } from '../types/auth';
import type {
  BusinessItem,
  BusinessVerticalMode,
  OwnerTokenSummary,
  UpdateBusinessPayload,
} from '../types/business';
import { api, businessApi } from '../services/api';
import { useDialog } from '../context/DialogContext';
import { TablePagination } from '../components/TablePagination';
import { CreateBusinessModal } from '../components/owner/CreateBusinessModal';
import { PakasirDirectQrisModal } from '../components/saas/PakasirDirectQrisModal';

export interface OwnerPortalPageProps {
  user: User;
  onSelectBusiness: (business: BusinessItem, outletId?: string) => void;
  onLogout: () => void;
  initialTab?: 'businesses' | 'tokens' | 'invoices';
}

const formatRupiah = (num: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
};

export const OwnerPortalPage: React.FC<OwnerPortalPageProps> = ({
  user,
  onSelectBusiness,
  onLogout,
  initialTab = 'businesses',
}) => {
  const { toast } = useDialog();

  // Active Tab: 'businesses' | 'tokens' | 'invoices'
  const [activeTab, setActiveTab] = useState<'businesses' | 'tokens' | 'invoices'>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Data State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [businesses, setBusinesses] = useState<BusinessItem[]>([]);
  const [tokenSummary, setTokenSummary] = useState<OwnerTokenSummary | null>(null);
  const [businessSearch, setBusinessSearch] = useState('');

  // Create Business Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Edit Business Modal State
  const [editingBusiness, setEditingBusiness] = useState<BusinessItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editSubCategory, setEditSubCategory] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');

  // Top Up Tokens State (Tab 2)
  const [tokenPresets, setTokenPresets] = useState<number[]>([500, 1000, 2500, 5000]);
  const [selectedTokens, setSelectedTokens] = useState<number>(500);
  const [customTokenInput, setCustomTokenInput] = useState<string>('500');
  const [isCustomTokens, setIsCustomTokens] = useState(false);
  const [tokenPrice, setTokenPrice] = useState<number>(100);
  const [minTokenPurchase, setMinTokenPurchase] = useState<number>(100);
  const hasInitializedPresetRef = React.useRef(false);

  // Promo Code State
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<any | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState('');

  // QRIS Payment Modal State
  const [submittingTopUp, setSubmittingTopUp] = useState(false);
  const [qrisModalData, setQrisModalData] = useState<{
    isOpen: boolean;
    invoiceNumber: string;
    amount: number;
    tokenAmount: number;
    qrString?: string;
  } | null>(null);

  // Invoice Pagination State (Tab 3)
  const [invoicePage, setInvoicePage] = useState<number>(1);
  const [invoicePageSize, setInvoicePageSize] = useState<number>(10);

  // Load All Data
  const loadPortalData = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      else setRefreshing(true);

      const [bizRes, tokenRes, configRes] = await Promise.all([
        businessApi.getBusinesses(),
        businessApi.getBusinessTokenSummary(),
        api.getPublicPlatformConfig().catch(() => null),
      ]);

      if (bizRes.status === 'success' && Array.isArray(bizRes.data)) {
        setBusinesses(bizRes.data);
      }

      if (tokenRes.status === 'success' && tokenRes.data) {
        setTokenSummary(tokenRes.data);
      }

      if (configRes && configRes.status === 'success' && configRes.data) {
        if (configRes.data.tokenPrice) setTokenPrice(configRes.data.tokenPrice);
        if (configRes.data.minTokenPurchase) setMinTokenPurchase(configRes.data.minTokenPurchase);
        if (Array.isArray(configRes.data.packages) && configRes.data.packages.length > 0) {
          const validPresets = configRes.data.packages
            .map((p: any) => p.tokens)
            .filter((t: any) => typeof t === 'number' && t > 0);
          if (validPresets.length > 0) {
            setTokenPresets(validPresets);
            if (!hasInitializedPresetRef.current) {
              hasInitializedPresetRef.current = true;
              setSelectedTokens(validPresets[0]);
              setCustomTokenInput(String(validPresets[0]));
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Error loading owner portal data:', err);
      toast('Gagal memuat data portal pemilik: ' + (err.message || 'Kesalahan jaringan'), 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPortalData();
  }, [loadPortalData]);

  // Handler Buka Edit Business
  const handleOpenEdit = (b: BusinessItem) => {
    setEditingBusiness(b);
    setEditName(b.name);
    setEditSubCategory(b.subCategory || '');
    setEditIsActive(b.isActive);
    setEditError('');
  };

  // Handler Simpan Edit Business
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBusiness) return;
    if (editName.trim().length < 2) {
      setEditError('Nama bisnis minimal 2 karakter');
      return;
    }

    try {
      setSavingEdit(true);
      setEditError('');
      const payload: UpdateBusinessPayload = {
        name: editName.trim(),
        subCategory: editSubCategory.trim() || null,
        isActive: editIsActive,
      };

      const res = await businessApi.updateBusiness(editingBusiness.id, payload);
      if (res.status === 'success' && res.data) {
        toast(`Profil bisnis "${res.data.name}" berhasil diperbarui`, 'success');
        setEditingBusiness(null);
        loadPortalData(true);
      } else {
        setEditError(res.message || 'Gagal memperbarui bisnis');
      }
    } catch (err: any) {
      setEditError(err.message || 'Gagal menghubungi server');
    } finally {
      setSavingEdit(false);
    }
  };

  // Handler Validasi Promo
  const handleValidatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = promoCodeInput.trim().toUpperCase();
    if (!code) return;

    try {
      setPromoLoading(true);
      setPromoError('');
      const effectiveTokens = isCustomTokens ? Number(customTokenInput) || 0 : selectedTokens;
      const res = await api.validateTenantPromo({ code, tokenAmount: effectiveTokens });

      if (res.status === 'success' && res.data) {
        setAppliedPromo(res.data);
        toast(`Promo ${code} berhasil diterapkan!`, 'success');
      } else {
        setAppliedPromo(null);
        setPromoError(res.message || 'Kode promo tidak valid atau telah kedaluwarsa');
      }
    } catch (err: any) {
      setAppliedPromo(null);
      setPromoError(err.message || 'Gagal memvalidasi kode promo');
    } finally {
      setPromoLoading(false);
    }
  };

  // Kalkulasi Harga Top Up
  const activeTokenAmount = isCustomTokens ? Math.max(minTokenPurchase, Number(customTokenInput) || minTokenPurchase) : selectedTokens;
  const rawTotalPrice = activeTokenAmount * tokenPrice;
  let finalTotalPrice = rawTotalPrice;
  let discountAmount = 0;
  let bonusTokens = 0;

  if (appliedPromo) {
    if (appliedPromo.type === 'DISCOUNT_PERCENT') {
      discountAmount = Math.round((rawTotalPrice * appliedPromo.value) / 100);
      if (appliedPromo.maxDiscount && discountAmount > appliedPromo.maxDiscount) {
        discountAmount = appliedPromo.maxDiscount;
      }
    } else if (appliedPromo.type === 'DISCOUNT_FIXED') {
      discountAmount = appliedPromo.value;
    } else if (appliedPromo.type === 'BONUS_TOKENS') {
      bonusTokens = appliedPromo.value;
    }
    finalTotalPrice = Math.max(0, rawTotalPrice - discountAmount);
  }

  // Handler Eksekusi Beli Token (Pakasir QRIS)
  const handleBuyTokens = async () => {
    try {
      setSubmittingTopUp(true);
      const res = await api.topUpTokens({
        tokenAmount: activeTokenAmount,
        promoCode: appliedPromo?.code,
        paymentMethod: 'QRIS',
      });

      if (res.status === 'success' && res.data) {
        setQrisModalData({
          isOpen: true,
          invoiceNumber: res.data.invoiceNumber,
          amount: res.data.amount,
          tokenAmount: activeTokenAmount + bonusTokens,
          qrString: res.data.qrString || res.data.paymentUrl,
        });
      } else {
        toast(res.message || 'Gagal membuat tagihan pembayaran token', 'error');
      }
    } catch (err: any) {
      console.error('Error initiating token top up:', err);
      toast(err.message || 'Terjadi kesalahan saat memproses pembelian token', 'error');
    } finally {
      setSubmittingTopUp(false);
    }
  };

  // Filter Bisnis untuk Tab 1
  const filteredBusinesses = businesses.filter((b) => {
    if (!businessSearch.trim()) return true;
    const query = businessSearch.toLowerCase();
    return (
      b.name.toLowerCase().includes(query) ||
      (b.subCategory && b.subCategory.toLowerCase().includes(query)) ||
      b.outlets.some((o) => o.name.toLowerCase().includes(query))
    );
  });

  const totalActiveBusinesses = businesses.filter((b) => b.isActive).length;
  const totalOutletsCount = businesses.reduce((acc, b) => acc + (b.outlets?.length || 0), 0);
  const remainingTokens = tokenSummary?.remainingTokens ?? 0;

  // Render Badge Vertikal
  const renderVerticalBadge = (vertical: BusinessVerticalMode) => {
    switch (vertical) {
      case 'LAUNDRY':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <Shirt className="w-3.5 h-3.5" />
            <span>Laundry & Dry Clean</span>
          </span>
        );
      case 'FNB':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>F&B / Kafe & Resto</span>
          </span>
        );
      case 'RETAIL':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Retail & Minimarket</span>
          </span>
        );
    }
  };

  // Helper Pagination Invoice (Tab 3)
  const invoicesList = tokenSummary?.recentInvoices || [];
  const safeInvoicePage = Math.min(
    Math.max(1, invoicePage),
    Math.max(1, Math.ceil(invoicesList.length / invoicePageSize))
  );
  const paginatedInvoices = invoicesList.slice(
    (safeInvoicePage - 1) * invoicePageSize,
    safeInvoicePage * invoicePageSize
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* ============================================================== */}
      {/* 1. TOP NAVBAR (WELL POS OWNER PORTAL)                         */}
      {/* ============================================================== */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo Brand & Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-blue-900 text-white flex items-center justify-center font-black text-xl shadow-md tracking-tight">
                W
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                    Well POS
                  </h1>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold tracking-wide uppercase bg-blue-100 text-blue-900">
                    Owner Portal
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">
                  Ruang Kendali Multi-Bisnis & Saldo Token Terpusat
                </p>
              </div>
            </div>

            {/* Right Action: Saldo Token Bersama + Profile & Logout */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Token Pill Button */}
              <button
                type="button"
                onClick={() => setActiveTab('tokens')}
                className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-2xl bg-gradient-to-r from-amber-50 to-amber-100/80 border border-amber-200 text-amber-900 hover:from-amber-100 hover:to-amber-200/80 transition-all shadow-xs"
                title="Buka menu Paket & Beli Token"
              >
                <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Zap className="w-3.5 h-3.5 fill-current" />
                </div>
                <div className="text-left">
                  <div className="text-[10px] uppercase font-bold text-amber-700 tracking-wider">
                    Sisa Token
                  </div>
                  <div className="text-xs sm:text-sm font-extrabold text-amber-950">
                    {loading ? '...' : remainingTokens.toLocaleString('id-ID')}
                  </div>
                </div>
                <span className="hidden md:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-600 text-white">
                  + Beli
                </span>
              </button>

              {/* User Avatar & Logout */}
              <div className="flex items-center gap-2 border-l border-slate-200 pl-2 sm:pl-4">
                <div className="hidden sm:block text-right">
                  <div className="text-xs font-bold text-slate-900 truncate max-w-[140px]">
                    {user.name}
                  </div>
                  <div className="text-[11px] text-slate-500">Pemilik Usaha</div>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="p-2 sm:p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition-colors"
                  title="Keluar dari Akun"
                  aria-label="Logout"
                >
                  <LogOut className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-100">
          <nav className="flex space-x-2 sm:space-x-8 overflow-x-auto scrollbar-none py-2">
            <button
              type="button"
              onClick={() => setActiveTab('businesses')}
              className={`flex items-center gap-2 py-2 px-3 rounded-xl sm:rounded-none sm:py-3 sm:px-1 border-b-0 sm:border-b-2 font-bold text-xs sm:text-sm whitespace-nowrap shrink-0 transition-all cursor-pointer ${activeTab === 'businesses'
                ? 'bg-blue-900 text-white sm:bg-transparent sm:text-blue-900 sm:border-blue-900'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 sm:hover:bg-transparent sm:border-transparent'
                }`}
            >
              <Store className="w-4 h-4" />
              <span>Bisnis Saya ({businesses.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tokens')}
              className={`flex items-center gap-2 py-2 px-3 rounded-xl sm:rounded-none sm:py-3 sm:px-1 border-b-0 sm:border-b-2 font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${activeTab === 'tokens'
                ? 'bg-blue-900 text-white sm:bg-transparent sm:text-blue-900 sm:border-blue-900'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 sm:hover:bg-transparent sm:border-transparent'
                }`}
            >
              <Zap className="w-4 h-4" />
              <span>Paket & Beli Token</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`flex items-center gap-2 py-2 px-3 rounded-xl sm:rounded-none sm:py-3 sm:px-1 border-b-0 sm:border-b-2 font-bold text-xs sm:text-sm whitespace-nowrap transition-all ${activeTab === 'invoices'
                ? 'bg-blue-900 text-white sm:bg-transparent sm:text-blue-900 sm:border-blue-900'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 sm:hover:bg-transparent sm:border-transparent'
                }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Invoice & Pemakaian Token</span>
            </button>
          </nav>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. MAIN CONTENT AREA                                           */}
      {/* ============================================================== */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* ========================================================== */}
        {/* TAB 1: BISNIS SAYA                                         */}
        {/* ========================================================== */}
        {activeTab === 'businesses' && (
          <div className="space-y-6">
            {/* Top KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Card 1: Total Bisnis Aktif */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-900 shrink-0">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total Bisnis Aktif
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
                    {loading ? '...' : totalActiveBusinesses}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Brand / Entitas Usaha</div>
                </div>
              </div>

              {/* Card 2: Total Cabang / Outlet */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-900 shrink-0">
                  <Store className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Total Cabang / Outlet
                  </div>
                  <div className="text-2xl font-extrabold text-slate-900 mt-0.5">
                    {loading ? '...' : totalOutletsCount}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Toko Fisik & Workshop</div>
                </div>
              </div>

              {/* Card 3: Saldo Token Bersama */}
              <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-5 rounded-2xl shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-amber-100 uppercase tracking-wider">
                    1 Dompet Token Bersama
                  </div>
                  <div className="text-2xl font-black mt-0.5">
                    {loading ? '...' : remainingTokens.toLocaleString('id-ID')}
                  </div>
                  <div className="text-xs text-amber-100 mt-0.5">
                    {tokenSummary?.estimatedDaysLeft !== null && tokenSummary?.estimatedDaysLeft !== undefined
                      ? `Cukup untuk ~${tokenSummary.estimatedDaysLeft} hari operasional`
                      : 'Kredit transaksi kasir'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('tokens')}
                  className="px-3.5 py-2 bg-white text-amber-900 rounded-xl font-bold text-xs hover:bg-amber-50 shadow-xs transition-colors shrink-0"
                >
                  Isi Ulang
                </button>
              </div>
            </div>

            {/* Toolbar: Search + Buat Bisnis Baru */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={businessSearch}
                  onChange={(e) => setBusinessSearch(e.target.value)}
                  placeholder="Cari bisnis berdasarkan nama atau cabang..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => loadPortalData(true)}
                  disabled={refreshing}
                  className="h-10 w-10 flex items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors shrink-0 cursor-pointer"
                  title="Muat Ulang Data"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(true)}
                  className="h-10 flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs sm:text-sm shadow-sm transition-colors shrink-0 whitespace-nowrap cursor-pointer"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  <span>Buat Bisnis Baru</span>
                </button>
              </div>
            </div>

            {/* Businesses Grid or Empty State */}
            {loading ? (
              <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
                <div className="w-8 h-8 border-3 border-blue-900/20 border-t-blue-900 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-600">Memuat portofolio bisnis Anda...</p>
              </div>
            ) : filteredBusinesses.length === 0 ? (
              <div className="bg-white p-10 sm:p-14 rounded-3xl border border-slate-200 text-center max-w-xl mx-auto shadow-xs">
                <div className="w-16 h-16 rounded-3xl bg-blue-50 border border-blue-100 text-blue-900 flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Store className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {businesses.length === 0
                    ? 'Belum Ada Bisnis Terdaftar'
                    : 'Tidak Ada Bisnis yang Cocok'}
                </h3>
                <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                  {businesses.length === 0
                    ? 'Mulai langkah awal Anda dengan membuat bisnis pertama (F&B, Retail, atau Laundry). Penambahan bisnis baru bebas biaya.'
                    : 'Coba ubah kata kunci pencarian Anda untuk menemukan bisnis yang dicari.'}
                </p>
                {businesses.length === 0 && (
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-sm shadow-md transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat Bisnis Pertama Sekarang</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredBusinesses.map((b) => (
                  <div
                    key={b.id}
                    className="bg-white rounded-3xl border border-slate-200 hover:border-blue-900/30 hover:shadow-lg transition-all flex flex-col overflow-hidden"
                  >
                    {/* Card Header */}
                    <div className="p-5 pb-4 border-b border-slate-100 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          {renderVerticalBadge(b.vertical)}
                          {!b.isActive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">
                              Non-aktif
                            </span>
                          )}
                        </div>
                        <h4 className="text-base font-extrabold text-slate-900 truncate">
                          {b.name}
                        </h4>
                        {b.subCategory && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {b.subCategory}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenEdit(b)}
                        className="p-2 text-slate-400 hover:text-blue-900 hover:bg-slate-100 rounded-xl transition-colors"
                        title="Edit Profil Bisnis"
                        aria-label="Edit Bisnis"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Card Body: Metrik & Outlets Preview */}
                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      {/* Metric Row */}
                      <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            Outlet Aktif
                          </div>
                          <div className="text-base font-bold text-slate-900 mt-0.5">
                            {b.totalActiveOutlets} / {b.outlets.length}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                            Total Order
                          </div>
                          <div className="text-base font-bold text-slate-900 mt-0.5">
                            {b.totalValidOrders.toLocaleString('id-ID')}
                          </div>
                        </div>
                      </div>

                      {/* Outlet List Preview */}
                      <div>
                        <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                          <span>Daftar Cabang</span>
                          <span className="text-slate-400 font-normal">
                            {b.outlets.length} outlet
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-32 overflow-y-auto no-scrollbar">
                          {b.outlets.slice(0, 3).map((out) => (
                            <div
                              key={out.id}
                              className="flex items-center justify-between text-xs p-2 rounded-xl bg-slate-50/60 border border-slate-100"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <div
                                  className={`w-2 h-2 rounded-full shrink-0 ${out.isActive ? 'bg-emerald-500' : 'bg-slate-300'
                                    }`}
                                />
                                <span className="font-semibold text-slate-800 truncate">
                                  {out.name}
                                </span>
                                {out.isWorkshop && (
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-100 text-sky-800 font-medium shrink-0">
                                    Workshop
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 shrink-0">
                                {out._count?.orders ?? 0} order
                              </span>
                            </div>
                          ))}
                          {b.outlets.length > 3 && (
                            <div className="text-[11px] text-slate-500 text-center py-1 font-medium">
                              +{b.outlets.length - 3} cabang lainnya
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Buka Dashboard CTA */}
                    <div className="p-4 bg-slate-50 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => onSelectBusiness(b, b.outlets[0]?.id)}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-sm shadow-xs transition-colors"
                      >
                        <span>Buka Dashboard</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================== */}
        {/* TAB 2: PAKET & BELI TOKEN                                   */}
        {/* ========================================================== */}
        {activeTab === 'tokens' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header Dompet Bersama */}
            <div className="bg-gradient-to-br from-blue-900 via-blue-950 to-slate-900 text-white p-6 sm:p-8 rounded-3xl shadow-lg relative overflow-hidden">
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-800/60 border border-blue-700/50 text-amber-300 text-xs font-bold mb-3">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Pay-As-You-Go Token Hub</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black tracking-tight">
                    Dompet Saldo Token Bersama
                  </h3>
                  <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-xl leading-relaxed">
                    1 Dompet Token digunakan bersama oleh seluruh bisnis Anda (F&B, Retail, Laundry).
                    Token hanya terpotong saat transaksi kasir diselesaikan (1 token = 1 order).
                  </p>
                </div>

                <div className="text-left sm:text-right bg-white/10 p-4 rounded-2xl border border-white/10 shrink-0">
                  <div className="text-xs uppercase font-bold text-slate-300 tracking-wider">
                    Sisa Saldo Token
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-amber-300 mt-0.5">
                    {remainingTokens.toLocaleString('id-ID')}
                  </div>
                  <div className="text-xs text-slate-300 mt-1">
                    {tokenSummary?.estimatedDaysLeft !== null && tokenSummary?.estimatedDaysLeft !== undefined
                      ? `Estimasi cukup ~${tokenSummary.estimatedDaysLeft} hari`
                      : 'Kredit operasional'}
                  </div>
                </div>
              </div>
            </div>

            {/* Pemilihan Paket Token */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xs space-y-6">
              <div>
                <h4 className="text-base font-extrabold text-slate-900">
                  Pilih Paket Isi Ulang Token
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Tarif standar: {formatRupiah(tokenPrice)} / token transaksi.
                </p>
              </div>

              {/* Preset Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {tokenPresets.map((tokens) => (
                  <button
                    key={tokens}
                    type="button"
                    onClick={() => {
                      setIsCustomTokens(false);
                      setSelectedTokens(tokens);
                      setCustomTokenInput(String(tokens));
                      setAppliedPromo(null);
                      setPromoError('');
                    }}
                    className={`p-4 rounded-2xl border text-center transition-all ${!isCustomTokens && selectedTokens === tokens
                      ? 'border-blue-900 bg-blue-50/70 ring-2 ring-blue-900/10 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'
                      }`}
                  >
                    <div className="text-xs font-semibold text-slate-500">Paket</div>
                    <div className="text-xl font-black text-slate-900 mt-0.5">
                      {tokens.toLocaleString('id-ID')}
                    </div>
                    <div className="text-xs text-blue-900 font-bold mt-1">
                      {formatRupiah(tokens * tokenPrice)}
                    </div>
                  </button>
                ))}
              </div>

              {/* Custom Token Input */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={isCustomTokens}
                    onChange={(e) => {
                      setIsCustomTokens(e.target.checked);
                      setAppliedPromo(null);
                      setPromoError('');
                    }}
                    className="w-4 h-4 rounded text-blue-900 border-slate-300 focus:ring-blue-900"
                  />
                  <span className="text-xs sm:text-sm font-bold text-slate-800">
                    Atau Masukkan Jumlah Token Kustom
                  </span>
                </label>

                {isCustomTokens && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <input
                      type="number"
                      min={minTokenPurchase}
                      step={50}
                      value={customTokenInput}
                      onChange={(e) => {
                        setCustomTokenInput(e.target.value);
                        setAppliedPromo(null);
                        setPromoError('');
                      }}
                      placeholder={`Minimal ${minTokenPurchase} token`}
                      className="w-full sm:w-48 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                    />
                    <span className="text-xs text-slate-500">
                      Minimal pembelian {minTokenPurchase} token
                    </span>
                  </div>
                )}
              </div>

              {/* Voucher Promo Section */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <form onSubmit={handleValidatePromo} className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={promoCodeInput}
                      onChange={(e) => setPromoCodeInput(e.target.value)}
                      placeholder="Masukkan Kode Voucher Promo..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm uppercase font-bold focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 bg-white"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={promoLoading || !promoCodeInput.trim()}
                    className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs sm:text-sm transition-colors"
                  >
                    {promoLoading ? 'Memeriksa...' : 'Terapkan'}
                  </button>
                </form>

                {promoError && (
                  <p className="text-xs text-rose-600 mt-2 font-medium">{promoError}</p>
                )}
                {appliedPromo && (
                  <div className="flex items-center justify-between text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 mt-2">
                    <span className="font-bold">
                      Voucher {appliedPromo.code} Aktif: {appliedPromo.name || 'Diskon / Bonus Diterapkan'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAppliedPromo(null)}
                      className="text-emerald-800 hover:underline font-bold"
                    >
                      Hapus
                    </button>
                  </div>
                )}
              </div>

              {/* Rincian Ringkasan & Tombol Beli */}
              <div className="border-t border-slate-100 pt-5 space-y-3">
                <div className="flex justify-between text-xs sm:text-sm text-slate-600">
                  <span>Jumlah Token</span>
                  <span className="font-bold text-slate-900">
                    {activeTokenAmount.toLocaleString('id-ID')} token
                  </span>
                </div>
                {bonusTokens > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm text-emerald-600">
                    <span>Bonus Token Promo</span>
                    <span className="font-bold">+{bonusTokens.toLocaleString('id-ID')} token</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div className="flex justify-between text-xs sm:text-sm text-emerald-600">
                    <span>Potongan Diskon</span>
                    <span className="font-bold">-{formatRupiah(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm sm:text-base font-extrabold text-slate-900 pt-2 border-t border-slate-100">
                  <span>Total Tagihan Pembayaran</span>
                  <span className="text-blue-900 text-lg sm:text-xl font-black">
                    {formatRupiah(finalTotalPrice)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleBuyTokens}
                  disabled={submittingTopUp}
                  className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white font-extrabold text-sm sm:text-base shadow-md transition-all mt-4"
                >
                  {submittingTopUp ? (
                    <>
                      <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Menyiapkan Kode QRIS Pakasir...</span>
                    </>
                  ) : (
                    <>
                      <QrCode className="w-5 h-5" />
                      <span>Beli Token Sekarang (QRIS Instan)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================== */}
        {/* TAB 3: INVOICE & PEMAKAIAN TOKEN                           */}
        {/* ========================================================== */}
        {activeTab === 'invoices' && (
          <div className="space-y-6">
            {/* Breakdown Pemakaian Token per Bisnis */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div>
                <h4 className="text-base font-extrabold text-slate-900">
                  Konsumsi Token Berdasarkan Bisnis
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Rincian transaksi order yang menggunakan kuota 1 dompet bersama milik tenant.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold border-y border-slate-100">
                    <tr>
                      <th className="py-3 px-4">Nama Bisnis</th>
                      <th className="py-3 px-4">Vertikal</th>
                      <th className="py-3 px-4 text-right">Order 30 Hari Terakhir</th>
                      <th className="py-3 px-4 text-right">Total Akumulasi Order</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {tokenSummary?.usageByBusiness && tokenSummary.usageByBusiness.length > 0 ? (
                      tokenSummary.usageByBusiness.map((bus) => (
                        <tr key={bus.businessId} className="hover:bg-slate-50/50">
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {bus.businessName}
                          </td>
                          <td className="py-3.5 px-4">
                            {renderVerticalBadge(bus.vertical)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-slate-700">
                            {bus.ordersLast30d.toLocaleString('id-ID')}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                            {bus.totalOrders.toLocaleString('id-ID')}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400 text-xs">
                          Belum ada riwayat konsumsi order dari bisnis apa pun.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Riwayat Faktur / Invoice Pembelian Token */}
            <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-extrabold text-slate-900">
                    Riwayat Pembelian Token (Faktur SaaS)
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Daftar invoice resmi transaksi top-up token dan langganan.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-bold border-y border-slate-100">
                    <tr>
                      <th className="py-3 px-4">No. Invoice</th>
                      <th className="py-3 px-4">Tanggal</th>
                      <th className="py-3 px-4 text-right">Jumlah Token</th>
                      <th className="py-3 px-4 text-right">Nominal Tagihan</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedInvoices.length > 0 ? (
                      paginatedInvoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/50">
                          <td className="py-3.5 px-4 font-mono font-bold text-xs text-slate-900">
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-500">
                            {new Date(inv.createdAt).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                            {inv.tokenAmount ? `+${inv.tokenAmount.toLocaleString('id-ID')}` : '-'}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                            {formatRupiah(inv.amount)}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {inv.status === 'PAID' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Lunas</span>
                              </span>
                            ) : inv.status === 'UNPAID' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3" />
                                <span>Belum Bayar</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                                <Ban className="w-3 h-3" />
                                <span>Batal</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            {inv.status === 'UNPAID' && (
                              <button
                                type="button"
                                onClick={() => {
                                  setQrisModalData({
                                    isOpen: true,
                                    invoiceNumber: inv.invoiceNumber,
                                    amount: inv.amount,
                                    tokenAmount: inv.tokenAmount || 0,
                                  });
                                }}
                                className="px-3 py-1 rounded-lg bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-xs transition-colors"
                              >
                                Bayar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-400 text-xs">
                          Belum ada riwayat faktur pembelian token.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Kanonikal */}
              {invoicesList.length > 0 && (
                <TablePagination
                  currentPage={safeInvoicePage}
                  pageSize={invoicePageSize}
                  totalItems={invoicesList.length}
                  onPageChange={setInvoicePage}
                  onPageSizeChange={(sz) => {
                    setInvoicePageSize(sz);
                    setInvoicePage(1);
                  }}
                  itemLabel="faktur"
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* ============================================================== */}
      {/* 3. MODALS                                                      */}
      {/* ============================================================== */}
      {/* A. Create Business Modal */}
      <CreateBusinessModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreated={() => {
          loadPortalData(true);
        }}
      />

      {/* B. Edit Business Modal */}
      {editingBusiness && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 bg-white shrink-0">
              <h3 className="font-bold text-base text-slate-900">Edit Profil Bisnis</h3>
              <button
                type="button"
                onClick={() => setEditingBusiness(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain flex-1">
                {editError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
                    {editError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Nama Bisnis / Brand <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Sub-Kategori / Model Usaha
                  </label>
                  <input
                    type="text"
                    value={editSubCategory}
                    onChange={(e) => setEditSubCategory(e.target.value)}
                    placeholder="misal: Specialty Coffee, Toko Grosir, dsb"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900"
                  />
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-900">Status Aktif Bisnis</div>
                    <div className="text-[11px] text-slate-500">
                      Non-aktifkan jika usaha ini sedang tutup sementara
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-900 border-slate-300 focus:ring-blue-900 shrink-0"
                  />
                </div>
              </div>

              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] grid grid-cols-2 sm:flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingBusiness(null)}
                  disabled={savingEdit}
                  className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 text-xs font-semibold flex items-center justify-center whitespace-nowrap cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || editName.trim().length < 2}
                  className="h-10 px-5 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center whitespace-nowrap cursor-pointer"
                >
                  {savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* C. Direct Pakasir QRIS Modal */}
      {qrisModalData && (
        <PakasirDirectQrisModal
          isOpen={qrisModalData.isOpen}
          onClose={() => setQrisModalData(null)}
          invoiceNumber={qrisModalData.invoiceNumber}
          amount={qrisModalData.amount}
          tokenAmount={qrisModalData.tokenAmount}
          qrString={qrisModalData.qrString}
          onSuccess={() => {
            setQrisModalData(null);
            toast('Pembayaran token berhasil dikonfirmasi!', 'success');
            loadPortalData(true);
          }}
        />
      )}
    </div>
  );
};
