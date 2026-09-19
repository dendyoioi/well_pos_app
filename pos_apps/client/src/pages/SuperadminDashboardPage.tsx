import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Store,
  Building2,
  Lock,
  Mail,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  LogOut,
  RefreshCw,
  Globe,
  TrendingUp,
  Eye,
  Calendar,
  ExternalLink,
  KeyRound,
  Copy,
  Check,
  Users,
  X,
  MessageSquare,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { api, platformStorage, authStorage } from '../services/api';

interface SuperadminDashboardPageProps {
  onBackToLanding: () => void;
  onOpenPos: () => void;
  onImpersonateSuccess?: (user: any) => void;
}

export const SuperadminDashboardPage: React.FC<SuperadminDashboardPageProps> = ({
  onBackToLanding,
  onOpenPos,
  onImpersonateSuccess,
}) => {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => !!platformStorage.getToken());
  const [currentUser, setCurrentUser] = useState<any>(() => platformStorage.getUser());

  // Login form state
  const [loginEmail, setLoginEmail] = useState('superadmin@wellpos.id');
  const [loginPassword, setLoginPassword] = useState('superadmin123');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Dashboard state
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Action status feedback
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // ----------------------------------------------------
  // MODAL 1: DETAIL TENANT (DEEP DIVE)
  // ----------------------------------------------------
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedTenantDetail, setSelectedTenantDetail] = useState<any>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ----------------------------------------------------
  // MODAL 2: UBAH & PERPANJANG LANGGANAN
  // ----------------------------------------------------
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subTenantTarget, setSubTenantTarget] = useState<any>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedDurationDays, setSelectedDurationDays] = useState(30);
  const [submittingSub, setSubmittingSub] = useState(false);

  // ----------------------------------------------------
  // MODAL 3: RESET PASSWORD OWNER
  // ----------------------------------------------------
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetResult, setResetResult] = useState<{
    ownerName: string;
    ownerEmail: string;
    temporaryPassword: string;
    businessName: string;
  } | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);

  // ----------------------------------------------------
  // MODAL 4: CUSTOM CONFIRMATION & ALERT MODALS (REPLACING NATIVE POPUPS)
  // ----------------------------------------------------
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText?: string;
    variant: 'emerald' | 'indigo' | 'rose';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Konfirmasi',
    variant: 'emerald',
    onConfirm: () => {},
  });

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    variant: 'error' | 'success' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'info',
  });

  const showConfirm = (opts: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'emerald' | 'indigo' | 'rose';
    onConfirm: () => void;
  }) => {
    setConfirmDialog({
      isOpen: true,
      title: opts.title,
      message: opts.message,
      confirmText: opts.confirmText || 'Ya, Lanjutkan',
      cancelText: opts.cancelText || 'Batal',
      variant: opts.variant || 'emerald',
      onConfirm: opts.onConfirm,
    });
  };

  const showAlert = (title: string, message: string, variant: 'error' | 'success' | 'info' = 'error') => {
    setAlertDialog({
      isOpen: true,
      title,
      message,
      variant,
    });
  };

  // Fetch dashboard and tenants
  const loadPlatformData = async () => {
    setLoadingData(true);
    setActionFeedback(null);
    try {
      const [dashRes, tenantsRes, plansRes] = await Promise.all([
        api.getPlatformDashboard(),
        api.getPlatformTenants({ search: searchQuery, status: statusFilter }),
        api.getPlatformPlans(),
      ]);

      if (dashRes.status === 'success') {
        setDashboardData(dashRes.data);
      }
      if (tenantsRes.status === 'success') {
        setTenants(tenantsRes.data || []);
      }
      if (plansRes.status === 'success') {
        setPlans(plansRes.data || []);
      }
    } catch (err: any) {
      console.error('Failed loading platform data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn) {
      loadPlatformData();

      // Auto-refresh data on window focus and every 5 seconds for real-time registrations
      const interval = setInterval(() => {
        loadPlatformData();
      }, 5000);

      const handleFocus = () => {
        loadPlatformData();
      };
      window.addEventListener('focus', handleFocus);

      return () => {
        clearInterval(interval);
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, [isLoggedIn, statusFilter]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);

    try {
      const res = await api.platformLogin(loginEmail, loginPassword);
      if (res.status === 'success' && res.data) {
        platformStorage.saveSession(res.data.token, res.data.user);
        setIsLoggedIn(true);
        setCurrentUser(res.data.user);
      } else {
        setLoginError(res.message || 'Kredensial Superadmin tidak valid');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Gagal menghubungi server');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    platformStorage.clearSession();
    setIsLoggedIn(false);
    setCurrentUser(null);
  };

  // Approve a PENDING tenant into TRIAL (PRO)
  const handleApproveTenant = (tenantId: string, businessName: string) => {
    showConfirm({
      title: 'Setujui Pendaftaran Klien',
      message: `Setujui pendaftaran bisnis "${businessName}" dan aktifkan masa uji coba paket PRO selama 14 hari penuh?`,
      confirmText: '✅ Ya, Setujui & Aktifkan PRO',
      variant: 'emerald',
      onConfirm: async () => {
        setActionLoadingId(tenantId);
        try {
          const res = await api.updateTenantStatus(tenantId, 'TRIAL', `Disetujui oleh Super Admin (${currentUser?.name || 'Superadmin'})`);
          if (res.status === 'success') {
            const recipient = (res as any).emailNotification?.recipient || 'email klien';
            setActionFeedback(`Pendaftaran klien "${businessName}" telah disetujui! 📧 Email konfirmasi aktivasi otomatis terkirim ke ${recipient}.`);
            showAlert(
              'Pendaftaran Disetujui & Email Terkirim',
              `Akun bisnis "${businessName}" telah berhasil disetujui dan paket PRO 14 Hari aktif.\n\n📧 Simulasi Email Terkirim:\nKepada: ${recipient}\nSubjek: Selamat! Akun Bisnis "${businessName}" Telah Disetujui & Aktif\n\nKlien sekarang dapat langsung masuk ke aplikasi dan memulai setup toko.`,
              'success'
            );
            await loadPlatformData();
          } else {
            showAlert('Gagal Menyetujui', res.message || 'Gagal menyetujui pendaftaran klien', 'error');
          }
        } catch (err: any) {
          showAlert('Kesalahan Sistem', err.message || 'Terjadi kesalahan sistem saat menyetujui akun', 'error');
        } finally {
          setActionLoadingId(null);
        }
      },
    });
  };

  // Toggle Suspend / Active status
  const handleToggleStatus = (tenantId: string, currentStatus: string, businessName: string) => {
    const newStatus = currentStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
    const actionLabel = newStatus === 'SUSPENDED' ? 'menonaktifkan (suspend)' : 'mengaktifkan kembali';

    showConfirm({
      title: newStatus === 'SUSPENDED' ? 'Bekukan Akses Tenant' : 'Aktifkan Kembali Tenant',
      message: `Apakah Anda yakin ingin ${actionLabel} tenant "${businessName}"?`,
      confirmText: newStatus === 'SUSPENDED' ? 'Bekukan Akses' : 'Aktifkan Kembali',
      variant: newStatus === 'SUSPENDED' ? 'rose' : 'emerald',
      onConfirm: async () => {
        setActionLoadingId(tenantId);
        try {
          const res = await api.updateTenantStatus(tenantId, newStatus, `Diubah oleh ${currentUser?.name || 'Superadmin'}`);
          if (res.status === 'success') {
            setActionFeedback(`Status tenant "${businessName}" berhasil diubah menjadi ${newStatus}.`);
            await loadPlatformData();
          } else {
            showAlert('Gagal Mengubah Status', res.message || 'Gagal memperbarui status', 'error');
          }
        } catch (err: any) {
          showAlert('Kesalahan Sistem', err.message || 'Terjadi kesalahan sistem', 'error');
        } finally {
          setActionLoadingId(null);
        }
      },
    });
  };

  // Open Detail Modal
  const handleOpenDetail = async (tenantId: string) => {
    setDetailModalOpen(true);
    setLoadingDetail(true);
    setSelectedTenantDetail(null);
    try {
      const res = await api.getPlatformTenantDetail(tenantId);
      if (res.status === 'success') {
        setSelectedTenantDetail(res.data);
      } else {
        showAlert('Gagal Memuat Detail', res.message || 'Gagal memuat detail tenant', 'error');
        setDetailModalOpen(false);
      }
    } catch (err: any) {
      showAlert('Kesalahan Sistem', err.message || 'Terjadi kesalahan saat memuat detail tenant', 'error');
      setDetailModalOpen(false);
    } finally {
      setLoadingDetail(false);
    }
  };

  // Open Subscription Modal
  const handleOpenSubModal = (tenant: any) => {
    setSubTenantTarget(tenant);
    // Pilih paket default
    if (plans.length > 0) {
      const matched = plans.find((p) => p.code === tenant.subscriptionPlan?.code);
      setSelectedPlanId(matched ? matched.id : plans[0].id);
    }
    setSelectedDurationDays(30);
    setSubModalOpen(true);
  };

  // Submit Subscription Update
  const handleSubmitSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subTenantTarget || !selectedPlanId) return;

    setSubmittingSub(true);
    try {
      const res = await api.updateTenantSubscription(subTenantTarget.id, selectedPlanId, selectedDurationDays);
      if (res.status === 'success') {
        setActionFeedback(res.message || 'Langganan berhasil diperbarui');
        setSubModalOpen(false);
        await loadPlatformData();
        if (detailModalOpen && selectedTenantDetail?.tenant.id === subTenantTarget.id) {
          handleOpenDetail(subTenantTarget.id);
        }
      } else {
        showAlert('Gagal Memperbarui', res.message || 'Gagal memperbarui langganan', 'error');
      }
    } catch (err: any) {
      showAlert('Kesalahan Sistem', err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setSubmittingSub(false);
    }
  };

  // Instant Switcher: Toggle FREE vs PRO
  const handleQuickTogglePlan = (tenant: any) => {
    const isCurrentlyPro = tenant.subscriptionPlan?.code === 'PRO';
    const targetPlanCode = isCurrentlyPro ? 'FREE' : 'PRO';

    showConfirm({
      title: 'Ubah Paket Langganan',
      message: `Ubah paket "${tenant.businessName}" menjadi paket ${targetPlanCode}?`,
      confirmText: `Ganti ke ${targetPlanCode}`,
      variant: 'indigo',
      onConfirm: async () => {
        setActionLoadingId(tenant.id);
        try {
          const matchedPlan = plans.find((p) => p.code === targetPlanCode);
          const res = await api.updateTenantSubscription(
            tenant.id,
            matchedPlan ? matchedPlan.id : undefined,
            targetPlanCode === 'PRO' ? 30 : 365,
            targetPlanCode
          );

          if (res.status === 'success') {
            setActionFeedback(`Paket "${tenant.businessName}" berhasil diubah menjadi ${targetPlanCode}!`);
            await loadPlatformData();
          } else {
            showAlert('Gagal Mengubah Paket', res.message || 'Gagal mengubah paket tenant', 'error');
          }
        } catch (err: any) {
          showAlert('Kesalahan Sistem', err.message || 'Terjadi kesalahan sistem', 'error');
        } finally {
          setActionLoadingId(null);
        }
      },
    });
  };

  // Impersonate Tenant (Buka Toko Klien)
  const handleImpersonate = (tenantId: string, businessName: string) => {
    showConfirm({
      title: 'Mode Inspeksi Superadmin',
      message: `Masuk ke dashboard toko "${businessName}" sebagai akun Owner untuk menginspeksi data operasional?`,
      confirmText: 'Buka Dashboard Toko',
      variant: 'emerald',
      onConfirm: async () => {
        setActionLoadingId(tenantId);
        try {
          const res = await api.impersonateTenant(tenantId);
          if (res.status === 'success' && res.data) {
            authStorage.saveSession(res.data.token, res.data.user);
            if (onImpersonateSuccess) {
              onImpersonateSuccess(res.data.user);
            } else {
              window.location.hash = 'pos';
              window.location.reload();
            }
          } else {
            showAlert('Gagal Impersonasi', res.message || 'Gagal mengimpersonasi tenant', 'error');
          }
        } catch (err: any) {
          showAlert('Kesalahan Koneksi', err.message || 'Gagal menghubungi server', 'error');
        } finally {
          setActionLoadingId(null);
        }
      },
    });
  };

  // Reset Password Owner
  const handleResetPassword = (tenantId: string) => {
    showConfirm({
      title: 'Reset Kata Sandi Owner',
      message: 'Setel ulang kata sandi akun Owner untuk toko ini? Kata sandi lama tidak dapat digunakan lagi.',
      confirmText: 'Reset Password',
      variant: 'rose',
      onConfirm: async () => {
        setResetLoading(true);
        setCopiedPass(false);
        try {
          const res = await api.resetTenantOwnerPassword(tenantId);
          if (res.status === 'success' && res.data) {
            setResetResult(res.data);
            setResetModalOpen(true);
          } else {
            showAlert('Gagal Reset', res.message || 'Gagal mereset kata sandi', 'error');
          }
        } catch (err: any) {
          showAlert('Kesalahan Sistem', err.message || 'Terjadi kesalahan sistem', 'error');
        } finally {
          setResetLoading(false);
        }
      },
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPass(true);
    setTimeout(() => setCopiedPass(false), 2500);
  };

  const formatRupiah = (val: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const cleanPhoneForWa = (phone?: string) => {
    if (!phone) return '';
    let p = phone.replace(/\D/g, '');
    if (p.startsWith('0')) p = '62' + p.slice(1);
    return p;
  };

  // =========================================================================
  // VIEW 1: SUPERADMIN LOGIN FORM
  // =========================================================================
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen w-full flex flex-col justify-center items-center p-4 bg-slate-900 text-slate-100 relative">
        <div className="w-full max-w-md bg-slate-800/90 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl relative">
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 mb-3">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-white">
              Platform Control Center
            </h1>
            <p className="text-xs text-indigo-300 mt-1 font-semibold uppercase tracking-wider">
              Level 1 &bull; Tim Internal Well POS
            </p>
          </div>

          {loginError && (
            <div className="mb-4 p-3 bg-rose-950/60 border border-rose-700 rounded-xl flex items-center gap-2 text-rose-300 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Email Superadmin:
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 text-white rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Kata Sandi:
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 focus:border-indigo-500 text-white rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-95"
            >
              {loginLoading ? 'Memverifikasi...' : 'Masuk ke Portal Platform'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-700 text-center">
            <button
              type="button"
              onClick={() => {
                setLoginEmail('superadmin@wellpos.id');
                setLoginPassword('superadmin123');
              }}
              className="text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
            >
              Gunakan Akun Default Superadmin
            </button>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-4 text-xs text-slate-400">
          <button
            type="button"
            onClick={onBackToLanding}
            className="hover:text-white transition-colors"
          >
            &larr; Kembali ke Website SaaS
          </button>
          <span>&bull;</span>
          <button
            type="button"
            onClick={onOpenPos}
            className="hover:text-white transition-colors"
          >
            Buka Mesin Kasir POS
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: SUPERADMIN DASHBOARD & TENANT MANAGEMENT
  // =========================================================================
  const metrics = dashboardData?.metrics || {
    totalTenants: 0,
    activeTenants: 0,
    trialTenants: 0,
    suspendedTenants: 0,
    projectedMRR: 0,
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-base">Well POS Platform</span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700">
                  Level 1 Superadmin
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Logged in as <span className="text-slate-200 font-semibold">{currentUser?.name}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onBackToLanding}
              className="px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Website Publik</span>
            </button>
            <button
              type="button"
              onClick={onOpenPos}
              className="px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-800 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Store className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Mesin Kasir</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs font-semibold text-rose-300 hover:text-rose-200 bg-rose-950/60 hover:bg-rose-900/60 border border-rose-800 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div className="p-3.5 bg-emerald-950/70 border border-emerald-700 text-emerald-200 rounded-2xl flex items-center justify-between text-xs animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="text-emerald-400 hover:text-white text-xs underline ml-4"
            >
              Tutup
            </button>
          </div>
        )}

        {/* Section 1: KPI Metrics Cards */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-black text-white">Ringkasan Eksekutif Platform</h2>
              <p className="text-xs text-slate-400">Pertumbuhan tenant, status langganan, dan proyeksi pendapatan bulanan</p>
            </div>
            <button
              type="button"
              onClick={loadPlatformData}
              disabled={loadingData}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-all"
              title="Perbarui Data"
            >
              <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-400">Total Tenant</span>
                <Building2 className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-2xl font-black text-white">{metrics.totalTenants}</p>
              <p className="text-[11px] text-slate-500 mt-1">Seluruh bisnis</p>
            </div>

            <div className="p-4 sm:p-5 bg-amber-950/40 border border-amber-800/80 rounded-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-300">Approval</span>
                <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
              </div>
              <p className="text-2xl font-black text-amber-200">
                {tenants.filter((t) => t.status === 'PENDING').length}
              </p>
              <p className="text-[11px] text-amber-400/80 mt-1">Menunggu persetujuan</p>
            </div>

            <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-400">Tenant Aktif</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-2xl font-black text-emerald-300">{metrics.activeTenants}</p>
              <p className="text-[11px] text-slate-500 mt-1">Berbayar</p>
            </div>

            <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-400">Uji Coba (Trial)</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-black text-amber-300">{metrics.trialTenants}</p>
              <p className="text-[11px] text-slate-500 mt-1">14 hari aktif</p>
            </div>

            <div className="p-4 sm:p-5 bg-slate-900 border border-slate-800 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-rose-400">Ditangguhkan</span>
                <XCircle className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-2xl font-black text-rose-400">{metrics.suspendedTenants}</p>
              <p className="text-[11px] text-slate-500 mt-1">Dibekukan</p>
            </div>

            <div className="col-span-2 sm:col-span-1 p-4 sm:p-5 bg-gradient-to-br from-indigo-900/60 to-slate-900 border border-indigo-700/60 rounded-2xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-indigo-200">Proyeksi MRR</span>
                <TrendingUp className="w-4 h-4 text-indigo-300" />
              </div>
              <p className="text-lg sm:text-xl font-black text-white">{formatRupiah(metrics.projectedMRR)}</p>
              <p className="text-[11px] text-indigo-300/80 mt-1">Estimasi bulanan</p>
            </div>
          </div>
        </section>

        {/* Section 2: Tenant Management Table */}
        <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h3 className="text-base font-bold text-white">Manajemen Tenant & Klien Well POS</h3>
              <p className="text-xs text-slate-400">Kelola operasional toko, perpanjang langganan, dan inspeksi toko klien</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-60">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari bisnis / email / subdomain..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadPlatformData()}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500 font-semibold"
              >
                <option value="">Semua Status</option>
                <option value="PENDING">⏳ Menunggu Approval (Pending)</option>
                <option value="TRIAL">Trial (Uji Coba)</option>
                <option value="ACTIVE">Aktif (Berbayar)</option>
                <option value="SUSPENDED">Suspended (Beku)</option>
              </select>

              <button
                type="button"
                onClick={loadPlatformData}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all"
              >
                Cari
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Bisnis & Subdomain</th>
                  <th className="py-3 px-4">Kontak Owner</th>
                  <th className="py-3 px-4">Paket</th>
                  <th className="py-3 px-4">Cabang</th>
                  <th className="py-3 px-4">Masa Berlaku</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Aksi Operasional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {tenants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      {loadingData ? 'Memuat data tenant...' : 'Tidak ada data tenant yang cocok.'}
                    </td>
                  </tr>
                ) : (
                  tenants.map((t) => {
                    const isPending = t.status === 'PENDING';
                    const isSuspended = t.status === 'SUSPENDED';
                    const isTrial = t.status === 'TRIAL';
                    const isActive = t.status === 'ACTIVE';

                    return (
                      <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <p className="font-bold text-white text-sm">{t.businessName}</p>
                          <span className="text-[10px] text-indigo-400 font-mono">
                            {t.subdomain}.wellpos.id
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="text-white font-semibold">{t.ownerName}</p>
                          <p className="text-[11px] text-slate-400">{t.email || '-'}</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border ${
                            t.subscriptionPlan?.code === 'PRO'
                              ? 'bg-indigo-950 text-indigo-300 border-indigo-700'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}>
                            {t.subscriptionPlan?.code === 'PRO' ? '⭐ PRO' : 'FREE'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-slate-300">
                          <p>{t._count?.outlets || 1} Cabang</p>
                          <p className="text-[11px] text-slate-500">{t._count?.users || 1} Staf</p>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="text-slate-200 font-semibold">
                            {isPending ? 'Menunggu Approval' : t.trialEndsAt ? new Date(t.trialEndsAt).toLocaleDateString('id-ID') : '-'}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {isPending ? 'Belum aktif' : isTrial ? 'Jatuh Tempo Trial' : 'Berakhir'}
                          </p>
                        </td>

                        <td className="py-3.5 px-4">
                          {isPending && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/50 animate-pulse">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>PENDING APPROVAL</span>
                            </span>
                          )}
                          {isSuspended && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                              <XCircle className="w-3 h-3" />
                              <span>SUSPENDED</span>
                            </span>
                          )}
                          {isTrial && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                              <Clock className="w-3 h-3" />
                              <span>TRIAL (14H)</span>
                            </span>
                          )}
                          {isActive && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>ACTIVE</span>
                            </span>
                          )}
                        </td>

                        {/* Action buttons */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            {isPending ? (
                              /* Tombol Persetujuan Cepat untuk Pendaftaran Baru */
                              <button
                                type="button"
                                disabled={actionLoadingId === t.id}
                                onClick={() => handleApproveTenant(t.id, t.businessName)}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg text-xs font-black shadow-md shadow-emerald-900/50 flex items-center gap-1.5 transition-all"
                                title="Setujui pendaftaran dan aktifkan paket PRO 14 hari"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-200" />
                                <span>{actionLoadingId === t.id ? 'Memproses...' : 'Setujui (Approve)'}</span>
                              </button>
                            ) : (
                              <>
                                {/* Instant Switcher: Jadikan PRO / Jadikan FREE */}
                                <button
                                  type="button"
                                  disabled={actionLoadingId === t.id}
                                  onClick={() => handleQuickTogglePlan(t)}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 ${
                                    t.subscriptionPlan?.code === 'PRO'
                                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600'
                                      : 'bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white shadow-xs'
                                  }`}
                                  title={
                                    t.subscriptionPlan?.code === 'PRO'
                                      ? 'Ubah instan menjadi paket FREE'
                                      : 'Ubah instan menjadi paket PRO'
                                  }
                                >
                                  {actionLoadingId === t.id ? (
                                    '...'
                                  ) : t.subscriptionPlan?.code === 'PRO' ? (
                                    <span>🔄 Jadikan FREE</span>
                                  ) : (
                                    <span>⚡ Jadikan PRO</span>
                                  )}
                                </button>

                                {/* Detail */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenDetail(t.id)}
                                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors"
                                  title="Lihat Detail & Kontak Toko"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                {/* Kelola Paket */}
                                <button
                                  type="button"
                                  onClick={() => handleOpenSubModal(t)}
                                  className="p-1.5 bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border border-indigo-800 rounded-lg transition-colors"
                                  title="Kelola Paket & Perpanjang Langganan"
                                >
                                  <Calendar className="w-3.5 h-3.5" />
                                </button>

                                {/* Impersonate */}
                                <button
                                  type="button"
                                  disabled={actionLoadingId === t.id}
                                  onClick={() => handleImpersonate(t.id, t.businessName)}
                                  className="p-1.5 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800 rounded-lg transition-colors"
                                  title="Buka Toko Klien (Mode Impersonasi)"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </button>

                                {/* Suspend / Aktifkan */}
                                <button
                                  type="button"
                                  disabled={actionLoadingId === t.id}
                                  onClick={() => handleToggleStatus(t.id, t.status, t.businessName)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                                    isSuspended
                                      ? 'bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-700'
                                      : 'bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800'
                                  }`}
                                >
                                  {actionLoadingId === t.id ? '...' : isSuspended ? 'Buka Suspend' : 'Suspend'}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* =========================================================================
          MODAL 1: DETAIL TENANT (TENANT DEEP DIVE)
      ========================================================================= */}
      {detailModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto text-slate-200">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setDetailModalOpen(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            {loadingDetail ? (
              <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-400">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                <p className="text-xs">Memuat data mendalam tenant...</p>
              </div>
            ) : selectedTenantDetail ? (
              <div className="space-y-6">
                {/* Header */}
                <div className="border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-black text-white">
                      {selectedTenantDetail.tenant.businessName}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                      {selectedTenantDetail.tenant.businessType || 'Retail / F&B'}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-400 font-mono mt-0.5">
                    {selectedTenantDetail.tenant.subdomain}.wellpos.id
                  </p>
                </div>

                {/* Section: Kontak Owner & Aksi Cepat */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Kontak Pemilik (Owner) Toko</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Nama Lengkap:</span>
                      <p className="font-bold text-white text-sm mt-0.5">
                        {selectedTenantDetail.owner?.name || 'Belum diatur'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Alamat Email:</span>
                      <p className="text-slate-200 mt-0.5">{selectedTenantDetail.owner?.email || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Nomor Telepon / WhatsApp:</span>
                      <p className="text-slate-200 mt-0.5 font-mono">{selectedTenantDetail.owner?.phone || '-'}</p>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Status Akun:</span>
                      <span className="text-emerald-400 font-bold mt-0.5 inline-block">Terverifikasi & Aktif</span>
                    </div>
                  </div>

                  {/* Actions for owner */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                    {/* WhatsApp Direct Link */}
                    {selectedTenantDetail.owner?.phone && (
                      <a
                        href={`https://wa.me/${cleanPhoneForWa(selectedTenantDetail.owner.phone)}?text=${encodeURIComponent(
                          `Halo ${selectedTenantDetail.owner.name}, kami dari Tim Support Well POS menginformasikan perihal layanan POS toko Anda (${selectedTenantDetail.tenant.businessName})...`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat via WhatsApp</span>
                      </a>
                    )}

                    {/* Reset password button */}
                    <button
                      type="button"
                      disabled={resetLoading}
                      onClick={() => handleResetPassword(selectedTenantDetail.tenant.id)}
                      className="px-3 py-1.5 bg-amber-950/80 hover:bg-amber-900/80 text-amber-300 border border-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{resetLoading ? 'Memproses...' : 'Reset Sandi Owner'}</span>
                    </button>

                    {/* Impersonate button */}
                    <button
                      type="button"
                      onClick={() => handleImpersonate(selectedTenantDetail.tenant.id, selectedTenantDetail.tenant.businessName)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ml-auto"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka Toko Ini</span>
                    </button>
                  </div>
                </div>

                {/* Section: Statistik Toko */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Statistik Akumulatif Toko</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <span className="text-[11px] text-slate-500 block">Total Omset</span>
                      <p className="text-sm font-black text-emerald-400 mt-0.5">
                        {formatRupiah(selectedTenantDetail.stats.totalRevenue)}
                      </p>
                    </div>
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <span className="text-[11px] text-slate-500 block">Jumlah Pesanan</span>
                      <p className="text-sm font-black text-white mt-0.5">
                        {selectedTenantDetail.stats.totalOrders} Transaksi
                      </p>
                    </div>
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <span className="text-[11px] text-slate-500 block">Katalog Produk</span>
                      <p className="text-sm font-black text-white mt-0.5">
                        {selectedTenantDetail.stats.totalProducts} Item
                      </p>
                    </div>
                    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                      <span className="text-[11px] text-slate-500 block">Cabang / Outlet</span>
                      <p className="text-sm font-black text-white mt-0.5">
                        {selectedTenantDetail.stats.totalOutlets} Cabang
                      </p>
                    </div>
                  </div>
                </div>

                {/* Section: Cabang Outlet Toko */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-2">
                    <Store className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Daftar Cabang Toko ({selectedTenantDetail.outlets.length})</span>
                  </h4>
                  <div className="space-y-2">
                    {selectedTenantDetail.outlets.map((o: any) => (
                      <div key={o.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-white">{o.name}</p>
                          <p className="text-slate-400 text-[11px]">{o.address || 'Alamat belum diatur'}</p>
                        </div>
                        <span className="text-slate-400 font-mono text-[11px]">{o.phone || '-'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Section: Status Paket & Perpanjangan */}
                <div className="p-4 bg-indigo-950/40 border border-indigo-900/60 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold text-indigo-300 block uppercase tracking-wider">
                      Paket Aktif Saat Ini
                    </span>
                    <p className="text-sm font-black text-white mt-0.5">
                      {selectedTenantDetail.currentSubscription?.planName || 'Starter Bulanan'}
                    </p>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Kedaluwarsa:{' '}
                      <span className="font-bold text-indigo-200">
                        {selectedTenantDetail.tenant.trialEndsAt
                          ? new Date(selectedTenantDetail.tenant.trialEndsAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })
                          : 'Tidak ada batas'}
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setDetailModalOpen(false);
                      handleOpenSubModal(selectedTenantDetail.tenant);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all flex items-center gap-1.5"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>Ubah / Perpanjang Paket</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: UBAH PAKET & PERPANJANG LANGGANAN
      ========================================================================= */}
      {subModalOpen && subTenantTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative text-slate-200">
            <button
              type="button"
              onClick={() => setSubModalOpen(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto mb-3">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-black text-white">Kelola Paket Langganan</h3>
              <p className="text-xs text-slate-400 mt-1">
                Perpanjang masa aktif tenant <span className="text-white font-bold">{subTenantTarget.businessName}</span>
              </p>
            </div>

            <form onSubmit={handleSubmitSubscription} className="space-y-4">
              {/* Dropdown paket */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Pilih Tingkatan Paket:
                </label>
                <div className="space-y-2">
                  {plans.map((p) => {
                    const isSelected = selectedPlanId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => setSelectedPlanId(p.id)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-md'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <p className="font-bold text-xs text-white">{p.name}</p>
                          <p className="text-[11px] text-slate-400">
                            Maksimal {p.maxOutlets} Cabang &bull; {p.maxCashiers} Kasir
                          </p>
                        </div>
                        <span className="font-black text-xs text-indigo-300">
                          {formatRupiah(p.price)}/bln
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Durasi Cepat */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Pilih Tambahan Durasi:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedDurationDays(30)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      selectedDurationDays === 30
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    +30 Hari (1 Bln)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDurationDays(90)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      selectedDurationDays === 90
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    +90 Hari (3 Bln)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDurationDays(365)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      selectedDurationDays === 365
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    +365 Hari (1 Thn)
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400">
                <span>Status tenant akan langsung diperbarui menjadi </span>
                <span className="font-bold text-emerald-400">ACTIVE</span>
                <span> dan masa berlaku diperpanjang {selectedDurationDays} hari sejak saat ini.</span>
              </div>

              <button
                type="submit"
                disabled={submittingSub}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-xs sm:text-sm flex items-center justify-center gap-2"
              >
                {submittingSub ? (
                  'Menyimpan...'
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan & Perpanjang Masa Aktif</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: HASIL RESET PASSWORD OWNER
      ========================================================================= */}
      {resetModalOpen && resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative text-slate-200">
            <button
              type="button"
              onClick={() => setResetModalOpen(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-3">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">Sandi Owner Berhasil Direset</h3>
              <p className="text-xs text-slate-400 mt-1">
                Berikan kata sandi sementara berikut kepada pemilik toko{' '}
                <span className="text-white font-semibold">{resetResult.businessName}</span>.
              </p>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 mb-5">
              <div>
                <span className="text-[11px] text-slate-500 block">Akun Login (Email):</span>
                <p className="text-xs font-semibold text-white mt-0.5">{resetResult.ownerEmail}</p>
              </div>

              <div>
                <span className="text-[11px] text-slate-500 block">Kata Sandi Baru Sementara:</span>
                <div className="mt-1 flex items-center justify-between p-2.5 bg-slate-900 border border-indigo-500/40 rounded-xl">
                  <span className="font-mono font-black text-base text-indigo-300 tracking-wider">
                    {resetResult.temporaryPassword}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(resetResult.temporaryPassword)}
                    className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs flex items-center gap-1 transition-all"
                  >
                    {copiedPass ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedPass ? 'Tersalin' : 'Salin'}</span>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setResetModalOpen(false)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: CUSTOM CONFIRMATION DIALOG (NO BROWSER POPUPS)
      ========================================================================= */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative text-slate-200">
            <div className="text-center mb-5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 border ${
                confirmDialog.variant === 'emerald'
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                  : confirmDialog.variant === 'rose'
                  ? 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                  : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400'
              }`}>
                {confirmDialog.variant === 'emerald' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : confirmDialog.variant === 'rose' ? (
                  <AlertCircle className="w-6 h-6" />
                ) : (
                  <ShieldAlert className="w-6 h-6" />
                )}
              </div>
              <h3 className="text-lg font-black text-white">{confirmDialog.title}</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {confirmDialog.message}
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors"
              >
                {confirmDialog.cancelText || 'Batal'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                  confirmDialog.onConfirm();
                }}
                className={`flex-1 py-2.5 text-white font-bold rounded-xl text-xs shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 ${
                  confirmDialog.variant === 'emerald'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/50'
                    : confirmDialog.variant === 'rose'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/50'
                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-900/50'
                }`}
              >
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: CUSTOM ALERT DIALOG (ERROR / INFO NOTIFICATION)
      ========================================================================= */}
      {alertDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative text-slate-200">
            <div className="text-center mb-5">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 border ${
                alertDialog.variant === 'error'
                  ? 'bg-rose-500/20 border-rose-500/30 text-rose-400'
                  : alertDialog.variant === 'success'
                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                  : 'bg-indigo-500/20 border-indigo-500/30 text-indigo-400'
              }`}>
                {alertDialog.variant === 'error' ? (
                  <AlertCircle className="w-6 h-6" />
                ) : alertDialog.variant === 'success' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <Sparkles className="w-6 h-6" />
                )}
              </div>
              <h3 className="text-lg font-black text-white">{alertDialog.title}</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {alertDialog.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAlertDialog((prev) => ({ ...prev, isOpen: false }))}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors shadow-lg shadow-indigo-900/50"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
