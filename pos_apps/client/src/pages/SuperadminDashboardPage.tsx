import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Store,
  Lock,
  Mail,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  LogOut,
  RefreshCw,
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
  ChevronDown,
  ChevronUp,
  Coins,
  Flame,
  CreditCard,
  Zap,
  Layers,
  Infinity,
  Receipt,
  Tag,
  UserPlus,
  FileText,
  Trash2,
  DollarSign,
  Printer,
  QrCode,
} from 'lucide-react';
import { api, platformStorage, authStorage } from '../services/api';
import { TablePagination } from '../components/TablePagination';

export interface TenantQuotaInfo {
  totalQuota: number;
  usedOrders: number;
  remainingQuota: number;
  percentUsed: number;
  quotaStatus: 'SAFE' | 'LOW' | 'EMPTY';
}

/**
 * Kalkulasi kuota token fleksibel untuk model bisnis Enterprise-Lite F&B Pay-As-You-Go.
 * Masa aktif selamanya (Never Expires).
 */
export const calculateTenantTokenQuota = (tenant: any): TenantQuotaInfo => {
  let totalQuota = 100; // Starter quota default (100 Bonus Token saat pendaftaran tenant di-approve)
  if (tenant?.tokenQuota !== undefined && tenant?.tokenQuota !== null && Number(tenant.tokenQuota) > 0) {
    totalQuota = Number(tenant.tokenQuota);
  } else if (tenant?.customTokenQuota !== undefined && tenant?.customTokenQuota !== null && Number(tenant.customTokenQuota) > 0) {
    totalQuota = Number(tenant.customTokenQuota);
  } else {
    totalQuota = 100; // Alokasi perdana pendaftaran tenant: 100 Token
  }

  const usedOrders = tenant?.ordersCount || tenant?._count?.orders || 0;
  const remainingQuota = Math.max(0, totalQuota - usedOrders);
  const percentUsed = totalQuota > 0 ? Math.min(100, Math.round((usedOrders / totalQuota) * 100)) : 100;

  let quotaStatus: 'SAFE' | 'LOW' | 'EMPTY' = 'SAFE';
  if (remainingQuota === 0) {
    quotaStatus = 'EMPTY';
  } else if (remainingQuota <= 100) {
    quotaStatus = 'LOW';
  }

  return {
    totalQuota,
    usedOrders,
    remainingQuota,
    percentUsed,
    quotaStatus,
  };
};

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
  const [loginPassword, setLoginPassword] = useState('SuperAdmin123!');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Dashboard state
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [tenants, setTenants] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [triageFilter, setTriageFilter] = useState<'ALL' | 'PENDING' | 'QUOTA_SAFE' | 'QUOTA_LOW' | 'QUOTA_EMPTY' | 'NO_STORE' | 'SUSPENDED'>('ALL');

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
  // NAVIGATION TABS: MERCHANT CONTROL, PLANS, BILLING, STAFF, PROMOS
  // ----------------------------------------------------
  const [activeMainTab, setActiveMainTab] = useState<'MERCHANTS' | 'PLANS' | 'BILLING' | 'STAFF' | 'PROMOS'>('MERCHANTS');

  // ----------------------------------------------------
  // DATA BUKU BESAR BILLING, INVOICE & MUTASI TOKEN
  // ----------------------------------------------------
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [selectedInvoiceModal, setSelectedInvoiceModal] = useState<any | null>(null);

  // ----------------------------------------------------
  // DATA TIM STAFF PLATFORM & RBAC
  // ----------------------------------------------------
  const [platformUsers, setPlatformUsers] = useState<any[]>([]);
  const [isCreateStaffModalOpen, setIsCreateStaffModalOpen] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({ name: '', email: '', password: '', role: 'SUPPORT' });
  const [submittingStaff, setSubmittingStaff] = useState(false);

  // ----------------------------------------------------
  // DATA MASTER PROMO SAAS (B2B VOUCHER ENGINE)
  // ----------------------------------------------------
  const [promos, setPromos] = useState<any[]>([]);
  const [isCreatePromoModalOpen, setIsCreatePromoModalOpen] = useState(false);
  const [newPromoForm, setNewPromoForm] = useState({
    code: '',
    name: '',
    type: 'DISCOUNT_PERCENT' as 'DISCOUNT_PERCENT' | 'DISCOUNT_FIXED' | 'BONUS_TOKENS',
    value: 20,
    minSpend: 199000,
    maxDiscount: 100000,
    usageLimit: 100,
    validUntil: '',
  });
  const [submittingPromo, setSubmittingPromo] = useState(false);

  // ----------------------------------------------------
  // PAGINATION STATES & AUTO-RESET (STANDAR KANONIKAL 10/25/50/100)
  // ----------------------------------------------------
  const [tenantPage, setTenantPage] = useState<number>(1);
  const [tenantPageSize, setTenantPageSize] = useState<number>(10);

  const [invoicePage, setInvoicePage] = useState<number>(1);
  const [invoicePageSize, setInvoicePageSize] = useState<number>(10);

  const [staffPage, setStaffPage] = useState<number>(1);
  const [staffPageSize, setStaffPageSize] = useState<number>(10);

  const [promoPage, setPromoPage] = useState<number>(1);
  const [promoPageSize, setPromoPageSize] = useState<number>(10);

  // Auto-reset page 1 when filter/search changes
  useEffect(() => {
    setTenantPage(1);
  }, [searchQuery, statusFilter, triageFilter]);

  useEffect(() => {
    setInvoicePage(1);
  }, [invoiceSearchQuery, invoiceStatusFilter]);

  useEffect(() => {
    setStaffPage(1);
  }, [platformUsers.length]);

  useEffect(() => {
    setPromoPage(1);
  }, [promos.length]);
  // ----------------------------------------------------
  const [isPaymentConfigModalOpen, setIsPaymentConfigModalOpen] = useState(false);
  const [paymentConfigLoading, setPaymentConfigLoading] = useState(false);
  const [paymentConfigSubmitting, setPaymentConfigSubmitting] = useState(false);
  const [paymentConfig, setPaymentConfig] = useState({
    merchantName: 'WELL POS PLATFORM HQ',
    nmid: 'ID1020030040050',
    bankName: 'BCA',
    accountNumber: '8830129381',
    accountHolder: 'PT WELL DIGITAL ASIA',
    imageUrl: 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=00020101021126580014ID.GO.QRIS.WWW01189360000201122334450215ID10200300400500303UME51440014ID.GO.QRIS.WWW0215ID10200300400500303UME5204581253033605802ID5919WELL+POS+PLATFORM+HQ6013JAKARTA+SELATAN61051219062070703A016304E1F4',
    notes: 'Scan dengan BCA Mobile, GoPay, OVO, Dana, ShopeePay, atau Livin Mandiri.',
  });

  // ----------------------------------------------------
  // MODAL 2: UBAH & TOP-UP KUOTA TOKEN TRANSAKSI
  // ----------------------------------------------------
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subTenantTarget, setSubTenantTarget] = useState<any>(null);
  const [subOutletTarget, setSubOutletTarget] = useState<any>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedDurationDays, setSelectedDurationDays] = useState(30);
  const [submittingSub, setSubmittingSub] = useState(false);

  // Top-Up Kuota Token Form States
  const [topUpMode, setTopUpMode] = useState<'PACKAGES' | 'CUSTOM'>('PACKAGES');
  const [customTokenAmount, setCustomTokenAmount] = useState<number>(1000);
  const [topUpNeverExpires, setTopUpNeverExpires] = useState<boolean>(true);
  const [topUpPaymentMethod, setTopUpPaymentMethod] = useState<string>('BANK_TRANSFER');
  const [topUpNotes, setTopUpNotes] = useState<string>('');
  const [topUpPromoCode, setTopUpPromoCode] = useState<string>('');

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
  // INLINE ACCORDION: DAFTAR TOKO FISIK OWNER (TANPA POPUP BERTUMPUK)
  // ----------------------------------------------------
  const [expandedOwnerId, setExpandedOwnerId] = useState<string | null>(null);

  // ----------------------------------------------------
  // MODAL 5: CUSTOM CONFIRMATION & ALERT MODALS (REPLACING NATIVE POPUPS)
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
      const [dashRes, tenantsRes, plansRes, invoicesRes, usersRes, promosRes] = await Promise.all([
        api.getPlatformDashboard(),
        api.getPlatformTenants({ search: searchQuery, status: statusFilter }),
        api.getPlatformPlans(),
        api.getPlatformInvoices(),
        api.getPlatformUsers(),
        api.getPlatformPromos(),
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
      if (invoicesRes.status === 'success') {
        setInvoices(invoicesRes.data || []);
      }
      if (usersRes.status === 'success') {
        setPlatformUsers(usersRes.data || []);
      }
      if (promosRes.status === 'success') {
        setPromos(promosRes.data || []);
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

  // Approve a PENDING tenant into ACTIVE / TRIAL
  const handleApproveTenant = (tenantId: string, businessName: string) => {
    showConfirm({
      title: 'Setujui Pendaftaran Owner',
      message: `Setujui pendaftaran akun pemilik "${businessName}" dan aktifkan akses login? Sistem otomatis menerbitkan & melunasi faktur aktivasi pendaftaran Rp 99.000 serta mengkreditkan 100 Bonus Token Transaksi.`,
      confirmText: '✅ Ya, Setujui Akun Owner (Rp 99rb + 100 Token)',
      variant: 'emerald',
      onConfirm: async () => {
        setActionLoadingId(tenantId);
        try {
          const res = await api.updateTenantStatus(tenantId, 'ACTIVE', `Disetujui oleh Super Admin (${currentUser?.name || 'Superadmin'})`);
          if (res.status === 'success') {
            const recipient = (res as any).emailNotification?.recipient || 'email klien';
            setActionFeedback(`Pendaftaran pemilik "${businessName}" telah disetujui! Faktur Rp 99.000 lunas & 100 Bonus Token aktif. 📧 Email konfirmasi aktivasi otomatis terkirim ke ${recipient}.`);
            showAlert(
              'Pendaftaran Disetujui & 100 Token Aktif',
              `Akun pemilik "${businessName}" telah berhasil disetujui.\n\nFaktur aktivasi pendaftaran Rp 99.000 telah lunas (PAID) dan 100 Bonus Token Transaksi telah masuk ke saldo kuota owner.\n\n📧 Simulasi Email Terkirim:\nKepada: ${recipient}\nSubjek: Selamat! Akun Pemilik "${businessName}" Telah Disetujui & Aktif\n\nOwner sekarang dapat langsung masuk ke dashboard dan menyelesaikan wizard pembuatan toko.`,
              'success'
            );
            if (detailModalOpen && selectedTenantDetail?.tenant?.id === tenantId) {
              setDetailModalOpen(false);
            }
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

  // Reject / Cancel Tenant Registration
  const handleRejectTenant = (tenantId: string, businessName: string) => {
    showConfirm({
      title: 'Tolak Pendaftaran Akun Pemilik',
      message: `Apakah Anda yakin ingin menolak pengajuan akun "${businessName}"? Status pendaftaran akan dibatalkan (CANCELLED) dan akses masuk ditolak.`,
      confirmText: '❌ Ya, Tolak Pendaftaran',
      variant: 'rose',
      onConfirm: async () => {
        setActionLoadingId(tenantId);
        try {
          const res = await api.updateTenantStatus(tenantId, 'CANCELLED', `Ditolak oleh Super Admin (${currentUser?.name || 'Superadmin'})`);
          if (res.status === 'success') {
            setActionFeedback(`Pendaftaran akun "${businessName}" telah ditolak/dibatalkan.`);
            showAlert(
              'Pendaftaran Ditolak',
              `Pengajuan pendaftaran "${businessName}" telah dibatalkan. Calon pengguna tidak dapat mengakses sistem.`,
              'info'
            );
            if (detailModalOpen && selectedTenantDetail?.tenant?.id === tenantId) {
              setDetailModalOpen(false);
            }
            await loadPlatformData();
          } else {
            showAlert('Gagal Menolak', res.message || 'Gagal menolak pendaftaran', 'error');
          }
        } catch (err: any) {
          showAlert('Kesalahan Sistem', err.message || 'Terjadi kesalahan sistem saat memproses penolakan', 'error');
        } finally {
          setActionLoadingId(null);
        }
      },
    });
  };

  // Toggle Suspend / Active status with Cascade rule
  const handleToggleStatus = (tenantId: string, currentStatus: string, businessName: string) => {
    const newStatus = currentStatus === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';

    showConfirm({
      title: newStatus === 'SUSPENDED' ? 'Bekukan Akun Owner' : 'Aktifkan Kembali Akun Owner',
      message:
        newStatus === 'SUSPENDED'
          ? `Bekukan akun pemilik "${businessName}"? Pemilik tidak akan dapat login dan seluruh toko fisik di bawah akun ini otomatis DINONAKTIFKAN (inaktif).`
          : `Aktifkan kembali akun pemilik "${businessName}" dan seluruh unit tokonya?`,
      confirmText: newStatus === 'SUSPENDED' ? 'Bekukan Akun (Toko Inaktif)' : 'Aktifkan Akun & Toko',
      variant: newStatus === 'SUSPENDED' ? 'rose' : 'emerald',
      onConfirm: async () => {
        setActionLoadingId(tenantId);
        try {
          const res = await api.updateTenantStatus(tenantId, newStatus, `Diubah oleh ${currentUser?.name || 'Superadmin'}`);
          if (res.status === 'success') {
            setActionFeedback(
              newStatus === 'SUSPENDED'
                ? `Akun pemilik "${businessName}" berhasil dibekukan dan seluruh unit tokonya dinonaktifkan.`
                : `Akun pemilik "${businessName}" berhasil diaktifkan kembali.`
            );
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

  // Toggle Inline Store Accordion for Owner (Tanpa Popup Bertumpuk)
  const handleToggleExpandStores = (tenantId: string) => {
    setExpandedOwnerId((prev) => (prev === tenantId ? null : tenantId));
  };

  // Toggle Store Status (Individual Outlet)
  const handleToggleOutletStatus = (outletId: string, storeName: string, currentActive: boolean) => {
    showConfirm({
      title: currentActive ? 'Nonaktifkan Toko Fisik' : 'Aktifkan Toko Fisik',
      message: currentActive
        ? `Nonaktifkan operasional toko "${storeName}"? Kasir di toko ini tidak akan dapat memproses transaksi.`
        : `Aktifkan kembali operasional toko "${storeName}"?`,
      confirmText: currentActive ? 'Nonaktifkan Toko' : 'Aktifkan Toko',
      variant: currentActive ? 'rose' : 'emerald',
      onConfirm: async () => {
        setActionLoadingId(outletId);
        try {
          const res = await api.togglePlatformOutletStatus(outletId, !currentActive);
          if (res.status === 'success') {
            setActionFeedback(`Status toko "${storeName}" berhasil diperbarui menjadi ${!currentActive ? 'AKTIF' : 'INAKTIF'}`);
            await loadPlatformData();
          } else {
            showAlert('Gagal Mengubah Status Toko', res.message || 'Gagal mengubah status toko', 'error');
          }
        } catch (err: any) {
          showAlert('Kesalahan Koneksi', err.message || 'Gagal menghubungi server', 'error');
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

  // Open Subscription Modal / Top-Up Token
  const handleOpenSubModal = (tenant: any, outlet?: any) => {
    setSubTenantTarget(tenant);
    setSubOutletTarget(outlet || null);
    setTopUpMode('PACKAGES');
    setTopUpNeverExpires(true);
    setTopUpPaymentMethod('BANK_TRANSFER');
    setTopUpNotes('');
    setTopUpPromoCode('');
    setCustomTokenAmount(1000);

    // Pilih paket default
    if (plans.length > 0) {
      const matched = plans.find((p) => p.code === tenant.subscriptionPlan?.code);
      setSelectedPlanId(matched ? matched.id : plans[0].id);
    }
    setSelectedDurationDays(30);
    setSubModalOpen(true);
  };

  // Submit Subscription Update / Top-Up Token
  const handleSubmitSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subTenantTarget || !selectedPlanId) return;

    setSubmittingSub(true);
    try {
      const effectiveDays = topUpNeverExpires ? null : selectedDurationDays;
      let finalTokenAmount = topUpMode === 'CUSTOM' ? customTokenAmount : undefined;

      const activePromo = promos.find((p) => p.code === topUpPromoCode && p.isActive);
      const selectedPlan = plans.find((p) => p.id === selectedPlanId);
      const baseCost = topUpMode === 'CUSTOM'
        ? customTokenAmount * 110
        : Number(selectedPlan?.price || 0);

      let discountAmount = 0;
      if (activePromo) {
        if (activePromo.type === 'DISCOUNT_PERCENT') {
          const rawDiscount = (baseCost * activePromo.value) / 100;
          discountAmount = activePromo.maxDiscount ? Math.min(rawDiscount, activePromo.maxDiscount) : rawDiscount;
        } else if (activePromo.type === 'DISCOUNT_FIXED') {
          discountAmount = Math.min(baseCost, activePromo.value);
        } else if (activePromo.type === 'BONUS_TOKENS') {
          const baseToken = topUpMode === 'CUSTOM' ? customTokenAmount : ((selectedPlan?.features as any)?.tokenQuota || 0);
          finalTokenAmount = baseToken + activePromo.value;
        }
      }

      const res = await api.updateTenantSubscription(
        subTenantTarget.id,
        selectedPlanId,
        effectiveDays,
        undefined,
        {
          neverExpires: topUpNeverExpires,
          tokenAmount: finalTokenAmount,
          notes: topUpNotes || (activePromo ? `Top-up dengan kupon promo ${activePromo.code}` : undefined),
          paymentMethod: topUpPaymentMethod,
          promoCode: activePromo ? activePromo.code : undefined,
          discountAmount,
          amount: Math.max(0, baseCost - discountAmount),
        }
      );
      if (res.status === 'success') {
        setActionFeedback(res.message || 'Top-up kuota token berhasil diproses');
        setSubModalOpen(false);
        await loadPlatformData();
        if (detailModalOpen && selectedTenantDetail?.tenant.id === subTenantTarget.id) {
          handleOpenDetail(subTenantTarget.id);
        }
      } else {
        showAlert('Gagal Memperbarui', res.message || 'Gagal memperbarui langganan/kuota', 'error');
      }
    } catch (err: any) {
      showAlert('Kesalahan Sistem', err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setSubmittingSub(false);
    }
  };

  // Staff Platform Handlers
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffForm.name || !newStaffForm.email || !newStaffForm.password) return;
    setSubmittingStaff(true);
    try {
      const res = await api.createPlatformUser(newStaffForm);
      if (res.status === 'success') {
        setActionFeedback(res.message || 'Staf platform berhasil ditambahkan');
        setIsCreateStaffModalOpen(false);
        setNewStaffForm({ name: '', email: '', password: '', role: 'SUPPORT' });
        await loadPlatformData();
      } else {
        showAlert('Gagal Menambah Staf', res.message || 'Gagal menambahkan staf platform', 'error');
      }
    } catch (err: any) {
      showAlert('Kesalahan Sistem', err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setSubmittingStaff(false);
    }
  };

  const handleDeleteStaff = (user: any) => {
    showConfirm({
      title: 'Hapus Staf Platform',
      message: `Hapus akun staf "${user.name}" (${user.role})? Akses login platform akan dicabut secara permanen.`,
      confirmText: 'Hapus Staf',
      variant: 'rose',
      onConfirm: async () => {
        try {
          const res = await api.deletePlatformUser(user.id);
          if (res.status === 'success') {
            setActionFeedback(res.message || 'Staf platform berhasil dihapus');
            await loadPlatformData();
          } else {
            showAlert('Gagal Menghapus', res.message || 'Gagal menghapus staf platform', 'error');
          }
        } catch (err: any) {
          showAlert('Kesalahan Sistem', err.message || 'Terjadi kesalahan sistem', 'error');
        }
      },
    });
  };

  // Promo Platform Handlers
  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPromoForm.code || !newPromoForm.name || !newPromoForm.value) return;
    setSubmittingPromo(true);
    try {
      const res = await api.createPlatformPromo(newPromoForm);
      if (res.status === 'success') {
        setActionFeedback(res.message || 'Kode promo berhasil diterbitkan');
        setIsCreatePromoModalOpen(false);
        setNewPromoForm({
          code: '',
          name: '',
          type: 'DISCOUNT_PERCENT',
          value: 20,
          minSpend: 199000,
          maxDiscount: 100000,
          usageLimit: 100,
          validUntil: '',
        });
        await loadPlatformData();
      } else {
        showAlert('Gagal Menerbitkan Promo', res.message || 'Gagal membuat kode promo', 'error');
      }
    } catch (err: any) {
      showAlert('Kesalahan Sistem', err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setSubmittingPromo(false);
    }
  };

  const handleTogglePromo = async (promo: any) => {
    try {
      const res = await api.togglePlatformPromo(promo.id);
      if (res.status === 'success') {
        setActionFeedback(res.message || 'Status promo berhasil diperbarui');
        await loadPlatformData();
      }
    } catch (err: any) {
      showAlert('Kesalahan Sistem', err.message || 'Terjadi kesalahan sistem', 'error');
    }
  };

  const handleDeletePromo = (promo: any) => {
    showConfirm({
      title: 'Hapus Kode Promo',
      message: `Hapus kode promo "${promo.code}" (${promo.name}) secara permanen?`,
      confirmText: 'Hapus Promo',
      variant: 'rose',
      onConfirm: async () => {
        try {
          const res = await api.deletePlatformPromo(promo.id);
          if (res.status === 'success') {
            setActionFeedback(res.message || 'Kode promo berhasil dihapus');
            await loadPlatformData();
          } else {
            showAlert('Gagal Menghapus', res.message || 'Gagal menghapus kode promo', 'error');
          }
        } catch (err: any) {
          showAlert('Kesalahan Sistem', err.message || 'Terjadi kesalahan sistem', 'error');
        }
      },
    });
  };

  // Impersonate Tenant (Buka Toko Klien)
  const handleImpersonate = (tenantId: string, businessName: string, outletId?: string) => {
    showConfirm({
      title: 'Mode Inspeksi Superadmin',
      message: `Masuk ke dashboard toko "${businessName}" sebagai akun Owner untuk menginspeksi data operasional?`,
      confirmText: 'Buka Dashboard Toko',
      variant: 'emerald',
      onConfirm: async () => {
        setActionLoadingId(outletId || tenantId);
        try {
          const res = await api.impersonateTenant(tenantId, outletId);
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

  // ----------------------------------------------------
  // HANDLER PENGATURAN QRIS STATIS PLATFORM & REKENING HQ
  // ----------------------------------------------------
  const handleOpenPaymentConfigModal = async () => {
    setIsPaymentConfigModalOpen(true);
    try {
      setPaymentConfigLoading(true);
      const res = await api.getPlatformPaymentSettings();
      if (res.status === 'success' && res.data) {
        setPaymentConfig({
          merchantName: res.data.merchantName || '',
          nmid: res.data.nmid || '',
          bankName: res.data.bankName || '',
          accountNumber: res.data.accountNumber || '',
          accountHolder: res.data.accountHolder || '',
          imageUrl: res.data.imageUrl || '',
          notes: res.data.notes || '',
        });
      }
    } catch (err: any) {
      console.error('Gagal mengambil konfigurasi QRIS platform:', err);
    } finally {
      setPaymentConfigLoading(false);
    }
  };

  const handleSavePaymentConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setPaymentConfigSubmitting(true);
      const res = await api.updatePlatformPaymentSettings(paymentConfig);
      if (res.status === 'success') {
        showAlert('Berhasil Disimpan', 'Pengaturan QRIS Statis & Rekening Bank Platform HQ berhasil diperbarui.', 'success');
        setIsPaymentConfigModalOpen(false);
      } else {
        showAlert('Gagal Menyimpan', res.message || 'Gagal menyimpan pengaturan QRIS', 'error');
      }
    } catch (err: any) {
      showAlert('Kesalahan Sistem', err.message || 'Terjadi kesalahan sistem', 'error');
    } finally {
      setPaymentConfigSubmitting(false);
    }
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
                setLoginPassword('SuperAdmin123!');
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
    totalOutlets: 0,
    activeOutlets: 0,
    projectedMRR: 0,
  };

  // Toko Fisik Aktif murni dihitung jika unit toko berstatus aktif DAN akun owner berstatus aktif
  const activeOutletsCount = metrics.activeOutlets !== undefined && metrics.activeOutlets !== null
    ? metrics.activeOutlets
    : tenants.reduce((acc, t) => {
        if (t.status === 'ACTIVE' || t.status === 'TRIAL') {
          return acc + (t.outlets?.filter((o: any) => o.isActive !== false).length || 0);
        }
        return acc;
      }, 0);

  // Model Bisnis F&B Pay-As-You-Go: Setup Fee Rp 99.000 / Merchant Onboarding (+100 Bonus Token)
  const ONBOARDING_SETUP_FEE = 99000;
  const approvedTenants = tenants.filter((t) => t.status === 'ACTIVE' || t.status === 'TRIAL');
  const totalSetupFee = approvedTenants.length * ONBOARDING_SETUP_FEE;

  // Ringkasan Sirkulasi Token & Burn Rate Transaksi
  const quotaSummary = tenants.reduce(
    (acc, t) => {
      const q = calculateTenantTokenQuota(t);
      if (t.status === 'ACTIVE' || t.status === 'TRIAL') {
        acc.totalQuotaInCirculation += q.totalQuota;
        acc.totalOrdersConsumed += q.usedOrders;
        if (q.quotaStatus === 'SAFE') acc.quotaSafeCount++;
        else if (q.quotaStatus === 'LOW') acc.quotaLowCount++;
        else if (q.quotaStatus === 'EMPTY') acc.quotaEmptyCount++;
      }
      return acc;
    },
    {
      totalQuotaInCirculation: 0,
      totalOrdersConsumed: 0,
      quotaSafeCount: 0,
      quotaLowCount: 0,
      quotaEmptyCount: 0,
    }
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-white text-base">Well POS Platform</span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700">
                  Level 1 Superadmin
                </span>
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-300 border border-amber-700/60 hidden md:inline-flex items-center gap-1">
                  <Coins className="w-3 h-3 text-amber-400" />
                  Enterprise-Lite F&amp;B • Token System
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Pusat Kendali Ekosistem Multi-Tenant, Kuota Token &amp; Onboarding Toko</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-xs text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-semibold text-[11px]">Sistem Operasional Normal</span>
            </div>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <div className="w-2 h-2 rounded-full bg-indigo-400" />
              <span className="text-slate-300 font-semibold">{currentUser?.name || 'Superadmin'}</span>
              <span className="text-slate-500 font-mono">({currentUser?.email})</span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Keluar dari Superadmin"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div className="p-4 bg-emerald-950/80 border border-emerald-800/80 rounded-2xl flex items-center justify-between text-xs text-emerald-300 animate-fade-in shadow-lg">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionFeedback}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="p-1 text-emerald-400 hover:text-emerald-200 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Banner Ringkasan Paradigma Enterprise-Lite F&B (Pay-As-You-Go) */}
        <section className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-900/60 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Model Bisnis Enterprise-Lite
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Infinity className="w-3 h-3 text-amber-400" /> Kuota Tanpa Hangus
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                Control Tower Kuota Fleksibel &amp; Merchant F&amp;B
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Skema Pay-As-You-Go khusus gerai F&amp;B: biaya registrasi awal Rp 99.000 (+100 Bonus Token) saat pendaftaran disetujui, dipadukan sistem token transaksi yang berlaku selamanya tanpa masa kedaluwarsa.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Setup Fee Awal</p>
                  <p className="text-xs font-black text-emerald-300">Rp 99.000 / Tenant (+100 Token)</p>
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                  <Coins className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Model Token</p>
                  <p className="text-xs font-black text-amber-300">1 Token / Struk Order</p>
                </div>
              </div>

              <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400">Durasi Masa Aktif</p>
                  <p className="text-xs font-black text-indigo-300">Never Expires (Abadi)</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 1: Top Platform KPIs */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Metrik Finansial &amp; Pertumbuhan Token</span>
            </h3>
            <button
              type="button"
              onClick={loadPlatformData}
              disabled={loadingData}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              <span>Refresh Realtime</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
            {/* KPI 1: Setup Fee Onboarding */}
            <div className="p-4 sm:p-5 bg-slate-900 border border-emerald-900/40 rounded-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-emerald-400">Penerimaan Setup Fee</span>
                <CreditCard className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-lg sm:text-xl font-black text-emerald-300">{formatRupiah(totalSetupFee)}</p>
              <p className="text-[11px] text-slate-400 mt-1">Rp 99.000 × {approvedTenants.length} Tenant</p>
            </div>

            {/* KPI 2: Sirkulasi Kuota Token */}
            <div className="p-4 sm:p-5 bg-slate-900 border border-amber-900/40 rounded-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-400">Sirkulasi Kuota Token</span>
                <Coins className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-lg sm:text-xl font-black text-amber-300">
                {quotaSummary.totalQuotaInCirculation.toLocaleString('id-ID')}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Kapasitas order aktif</p>
            </div>

            {/* KPI 3: Konsumsi Transaksi F&B (Burn Rate) */}
            <div className="p-4 sm:p-5 bg-slate-900 border border-rose-900/40 rounded-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-rose-400">Konsumsi Transaksi</span>
                <Flame className="w-4 h-4 text-rose-400" />
              </div>
              <p className="text-lg sm:text-xl font-black text-rose-300">
                {(metrics.totalOrders || quotaSummary.totalOrdersConsumed).toLocaleString('id-ID')} Struk
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Total order diproses</p>
            </div>

            {/* KPI 4: Gerai F&B Beroperasi */}
            <div className="p-4 sm:p-5 bg-slate-900 border border-sky-900/40 rounded-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-sky-400">Gerai F&amp;B Aktif</span>
                <Store className="w-4 h-4 text-sky-400" />
              </div>
              <p className="text-lg sm:text-xl font-black text-sky-300">{activeOutletsCount} Gerai</p>
              <p className="text-[11px] text-slate-400 mt-1">Toko fisik beroperasi</p>
            </div>

            {/* KPI 5: Antrean Calon Owner */}
            <div className="p-4 sm:p-5 bg-slate-900 border border-purple-900/40 rounded-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-purple-300">Antrean Approval</span>
                <Clock className="w-4 h-4 text-purple-400 animate-pulse" />
              </div>
              <p className="text-lg sm:text-xl font-black text-purple-200">
                {tenants.filter((t) => t.status === 'PENDING').length} Calon
              </p>
              <p className="text-[11px] text-slate-400 mt-1">Perlu diverifikasi</p>
            </div>
          </div>
        </section>

        {/* Navigation Tabs: Merchants, Master Paket, Billing & Mutasi Token, Staff Platform, Promos */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-none snap-x -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            type="button"
            onClick={() => setActiveMainTab('MERCHANTS')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 snap-start cursor-pointer ${
              activeMainTab === 'MERCHANTS'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Store className="w-4 h-4 text-indigo-300" />
            <span className="hidden sm:inline">Manajemen Merchant &amp; Kuota Token</span>
            <span className="sm:hidden">Merchant &amp; Kuota</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/20 font-black">
              {tenants.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('PLANS')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 snap-start cursor-pointer ${
              activeMainTab === 'PLANS'
                ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30 ring-2 ring-amber-400/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Layers className="w-4 h-4 text-amber-300" />
            <span className="hidden sm:inline">Master Paket Kuota Fleksibel</span>
            <span className="sm:hidden">Paket Kuota</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400/20 text-amber-300 font-black">
              {plans.length || 4} Paket
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('BILLING')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 snap-start cursor-pointer ${
              activeMainTab === 'BILLING'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Receipt className="w-4 h-4 text-emerald-300" />
            <span className="hidden sm:inline">Riwayat Billing &amp; Invoicing</span>
            <span className="sm:hidden">Billing &amp; Invoice</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-400/20 text-emerald-300 font-black">
              {invoices.length} Faktur
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('STAFF')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 snap-start cursor-pointer ${
              activeMainTab === 'STAFF'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-2 ring-purple-400/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Users className="w-4 h-4 text-purple-300" />
            <span className="hidden sm:inline">Tim Staff Platform (RBAC)</span>
            <span className="sm:hidden">Staff Platform</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-purple-400/20 text-purple-300 font-black">
              {platformUsers.length} Staf
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMainTab('PROMOS')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shrink-0 snap-start cursor-pointer ${
              activeMainTab === 'PROMOS'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 ring-2 ring-rose-400/20'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <Tag className="w-4 h-4 text-rose-300" />
            <span className="hidden sm:inline">Master Promo SaaS (B2B)</span>
            <span className="sm:hidden">Promo B2B</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-rose-400/20 text-rose-300 font-black">
              {promos.length} Kupon
            </span>
          </button>
        </div>

        {/* Section 2: Owner Account Approval & Store Monitoring Table */}
        {activeMainTab === 'MERCHANTS' && (() => {
          const filteredTenants = tenants.filter((t) => {
            const outletsCount = t.outlets?.length || t._count?.outlets || 0;
            const quota = calculateTenantTokenQuota(t);
            if (triageFilter === 'PENDING') return t.status === 'PENDING';
            if (triageFilter === 'QUOTA_SAFE') return t.status !== 'PENDING' && quota.quotaStatus === 'SAFE';
            if (triageFilter === 'QUOTA_LOW') return t.status !== 'PENDING' && quota.quotaStatus === 'LOW';
            if (triageFilter === 'QUOTA_EMPTY') return t.status !== 'PENDING' && quota.quotaStatus === 'EMPTY';
            if (triageFilter === 'NO_STORE') return t.status !== 'PENDING' && outletsCount === 0;
            if (triageFilter === 'SUSPENDED') return t.status === 'SUSPENDED' || t.status === 'CANCELLED';
            return true;
          });

          const tenantTotalPages = Math.max(1, Math.ceil(filteredTenants.length / tenantPageSize));
          const safeTenantPage = Math.min(Math.max(1, tenantPage), tenantTotalPages);
          const paginatedTenants = filteredTenants.slice(
            (safeTenantPage - 1) * tenantPageSize,
            safeTenantPage * tenantPageSize
          );

          return (
            <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-base font-bold text-white">Persetujuan &amp; Monitoring Saldo Kuota Merchant</h3>
                  <p className="text-xs text-slate-400">Verifikasi pendaftaran akun pemilik, pantau status saldo token transaksi tanpa hangus, dan kelola gerai fisik klien.</p>
                </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Cari nama pemilik / email / WhatsApp..."
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
                aria-label="Filter Status Akun"
              >
                <option value="">Semua Status Akun</option>
                <option value="PENDING">⏳ Menunggu Approval (Pending)</option>
                <option value="ACTIVE">✅ Active (Aktif)</option>
                <option value="INACTIVE">❌ Inactive (Tidak Aktif)</option>
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

          {/* Segmented Triage Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 mb-5 pb-3 border-b border-slate-800/80">
            <button
              type="button"
              onClick={() => setTriageFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                triageFilter === 'ALL'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>Semua Pendaftar</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 font-bold">{tenants.length}</span>
            </button>

            <button
              type="button"
              onClick={() => setTriageFilter('PENDING')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                triageFilter === 'PENDING'
                  ? 'bg-amber-600 text-white shadow-md'
                  : 'bg-slate-950 text-amber-400/80 hover:text-amber-300 border border-slate-800'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>⏳ Menunggu Approval</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400/20 text-amber-200 font-bold">
                {tenants.filter((t) => t.status === 'PENDING').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTriageFilter('QUOTA_SAFE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                triageFilter === 'QUOTA_SAFE'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-slate-950 text-emerald-400/80 hover:text-emerald-300 border border-slate-800'
              }`}
            >
              <Coins className="w-3.5 h-3.5" />
              <span>🟢 Kuota Aman (&gt; 100)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-400/20 text-emerald-200 font-bold">
                {quotaSummary.quotaSafeCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTriageFilter('QUOTA_LOW')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                triageFilter === 'QUOTA_LOW'
                  ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                  : 'bg-slate-950 text-amber-300/90 hover:text-amber-200 border border-slate-800'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>🟡 Kuota Menipis (≤ 100)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400/20 text-amber-300 font-bold">
                {quotaSummary.quotaLowCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTriageFilter('QUOTA_EMPTY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                triageFilter === 'QUOTA_EMPTY'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-slate-950 text-rose-400/80 hover:text-rose-300 border border-slate-800'
              }`}
            >
              <Flame className="w-3.5 h-3.5" />
              <span>🔴 Kuota Habis (0)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-400/20 text-rose-200 font-bold">
                {quotaSummary.quotaEmptyCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTriageFilter('NO_STORE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                triageFilter === 'NO_STORE'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-slate-950 text-purple-400/80 hover:text-purple-300 border border-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>🆕 Belum Buat Toko</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-400/20 text-purple-200 font-bold">
                {tenants.filter((t) => t.status !== 'PENDING' && (!t.outlets || t.outlets.length === 0)).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setTriageFilter('SUSPENDED')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                triageFilter === 'SUSPENDED'
                  ? 'bg-slate-700 text-white shadow-md'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-300 border border-slate-800'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>🚫 Nonaktif / Suspend</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-700/60 text-slate-300 font-bold">
                {tenants.filter((t) => t.status === 'SUSPENDED' || t.status === 'CANCELLED').length}
              </span>
            </button>
          </div>

          {/* Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">Nama Pemilik &amp; Usaha</th>
                  <th className="py-3.5 px-4">Kontak (Email &amp; WA)</th>
                  <th className="py-3.5 px-4 min-w-[220px]">Saldo Kuota Token (Pay-As-You-Go)</th>
                  <th className="py-3.5 px-4">Gerai Fisik F&amp;B</th>
                  <th className="py-3.5 px-4">Status Akun</th>
                  <th className="py-3.5 px-4 text-right">Aksi Operasional</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {paginatedTenants.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      {loadingData ? 'Memuat data akun pemilik...' : 'Tidak ada data pendaftar yang cocok dengan filter.'}
                    </td>
                  </tr>
                ) : (
                  paginatedTenants.map((t) => {
                    const isPending = t.status === 'PENDING';
                    const isSuspended = t.status === 'SUSPENDED';
                    const outletsCount = t.outlets?.length || t._count?.outlets || 0;
                    const hasStore = outletsCount > 0;
                    const primaryOutlet = t.outlets && t.outlets.length > 0 ? t.outlets[0] : null;
                    const quota = calculateTenantTokenQuota(t);

                    return (
                      <React.Fragment key={t.id}>
                        <tr className="hover:bg-slate-800/40 transition-colors">
                        {/* 1. Nama Pemilik & Usaha F&B */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-lg shadow-indigo-600/20 border border-white/10">
                              {(t.ownerName || 'OW').slice(0, 2).toUpperCase()}
                            </div>
                            <div className="space-y-0.5">
                              <p className="font-bold text-white text-sm flex items-center gap-1.5">
                                <span>{t.ownerName}</span>
                                <span className="text-[10px] font-semibold text-slate-400 font-normal">(Owner)</span>
                              </p>
                              <p className="text-xs font-semibold text-indigo-300 flex items-center gap-1 truncate max-w-[170px]" title={t.businessName || t.name}>
                                <Store className="w-3 h-3 text-indigo-400 shrink-0" />
                                <span>{t.businessName || t.name}</span>
                              </p>
                              <div className="flex items-center gap-1.5 pt-0.5 flex-wrap">
                                {isPending ? (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-300 bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-800/60">
                                    <Clock className="w-2.5 h-2.5" />
                                    <span>Setup Fee Pending (Rp 99rb)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-300 bg-emerald-950/70 px-1.5 py-0.5 rounded border border-emerald-800/60">
                                    <Check className="w-2.5 h-2.5 text-emerald-400" />
                                    <span>Setup Fee Lunas (Rp 99rb / Tenant + 100 Token)</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. Kontak (Email & WhatsApp) */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1.5">
                            <p className="text-slate-200 font-medium text-xs flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[150px]" title={t.email}>{t.email || '-'}</span>
                            </p>
                            {t.phone && t.phone !== '-' ? (
                              <a
                                href={`https://wa.me/${t.phone.replace(/[^0-9]/g, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-emerald-400 hover:text-emerald-300 font-mono flex items-center gap-1.5 transition-colors font-semibold"
                                title="Buka WhatsApp Chat Langsung"
                              >
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>{t.phone}</span>
                              </a>
                            ) : (
                              <span className="text-[11px] text-slate-500">-</span>
                            )}
                          </div>
                        </td>

                        {/* 3. Saldo Kuota Token & Laju Transaksi (Enterprise-Lite F&B) */}
                        <td className="py-3.5 px-4 min-w-[220px]">
                          {isPending ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                <Clock className="w-3 h-3 text-amber-400" />
                                <span>Alokasi Perdana 100 Token</span>
                              </span>
                              <p className="text-[10px] text-slate-500">Aktif otomatis saat disetujui</p>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-sm font-black text-white">
                                    {quota.remainingQuota.toLocaleString('id-ID')}
                                  </span>
                                  <span className="text-[11px] text-slate-400">
                                    / {quota.totalQuota.toLocaleString('id-ID')} Token
                                  </span>
                                </div>
                                {/* Badge Status Kuota Dinamis */}
                                {quota.quotaStatus === 'SAFE' && (
                                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    <span>Aman</span>
                                  </span>
                                )}
                                {quota.quotaStatus === 'LOW' && (
                                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    <span>Menipis</span>
                                  </span>
                                )}
                                {quota.quotaStatus === 'EMPTY' && (
                                  <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                    <span>Habis</span>
                                  </span>
                                )}
                              </div>

                              {/* Dynamic Visual Progress Bar */}
                              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60 relative">
                                <div
                                  className={`h-full transition-all duration-500 rounded-full ${
                                    quota.quotaStatus === 'SAFE'
                                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                      : quota.quotaStatus === 'LOW'
                                      ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                                      : 'bg-gradient-to-r from-rose-600 to-rose-500'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(4, 100 - quota.percentUsed))}%` }}
                                  title={`Sisa Kuota: ${quota.remainingQuota} (${100 - quota.percentUsed}%)`}
                                />
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                                <span className="flex items-center gap-1 text-slate-300 font-medium">
                                  <Flame className="w-3 h-3 text-rose-400 shrink-0" />
                                  <span>{quota.usedOrders.toLocaleString('id-ID')} order selesai</span>
                                </span>
                                <span className="text-amber-300 font-bold flex items-center gap-0.5 text-[9px]">
                                  <Infinity className="w-2.5 h-2.5 text-amber-400" />
                                  <span>Tanpa Hangus</span>
                                </span>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* 4. Status Toko Fisik */}
                        <td className="py-3.5 px-4">
                          {!hasStore ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                                <span>Belum Ada Toko</span>
                              </span>
                              <p className="text-[10px] text-slate-500">
                                {isPending ? 'Menunggu approval owner' : 'Menunggu login setup wizard'}
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <button
                                type="button"
                                onClick={() => handleToggleExpandStores(t.id)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black border transition-all cursor-pointer ${
                                  expandedOwnerId === t.id
                                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md ring-2 ring-indigo-500/30'
                                    : 'bg-indigo-950/80 hover:bg-indigo-900/80 text-indigo-300 border-indigo-800'
                                }`}
                                title={expandedOwnerId === t.id ? 'Tutup Rincian Toko' : 'Klik untuk melihat rincian toko fisik di bawah baris ini'}
                              >
                                <Store className="w-3 h-3 text-indigo-400" />
                                <span>{outletsCount} Gerai F&amp;B</span>
                                {expandedOwnerId === t.id ? (
                                  <ChevronUp className="w-3 h-3 text-indigo-200" />
                                ) : (
                                  <ChevronDown className="w-3 h-3 text-indigo-400" />
                                )}
                              </button>
                              <p className="text-[11px] font-bold text-white truncate max-w-[150px]" title={primaryOutlet?.name}>
                                {primaryOutlet?.name}
                              </p>
                              {outletsCount > 1 && (
                                <p className="text-[10px] text-indigo-400 font-semibold">
                                  +{outletsCount - 1} Gerai Lainnya
                                </p>
                              )}
                            </div>
                          )}
                        </td>

                        {/* 5. Status Akun (Murni Biner: ACTIVE / INACTIVE untuk Owner) */}
                        <td className="py-3.5 px-4">
                          {isPending ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/40 animate-pulse">
                                <Clock className="w-3 h-3 text-amber-400" />
                                <span>PENDING APPROVAL</span>
                              </span>
                              <p className="text-[10px] text-slate-500">Owner belum bisa login</p>
                            </div>
                          ) : isSuspended ? (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                                <XCircle className="w-3 h-3 text-rose-400" />
                                <span>INACTIVE</span>
                              </span>
                              <p className="text-[10px] text-rose-400/80 font-medium">Semua gerai inaktif</p>
                            </div>
                          ) : (
                            <div className="space-y-0.5">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>ACTIVE</span>
                              </span>
                              <p className="text-[10px] text-slate-500">Izin login aktif</p>
                            </div>
                          )}
                        </td>

                        {/* 6. Aksi Operasional (dengan Quick Top-Up Button) */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            {isPending ? (
                              <div className="inline-flex items-center gap-1.5 justify-end">
                                {/* Lihat Profil Pendaftar */}
                                <div className="relative group">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDetail(t.id)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                                    title="Lihat Detail Profil & Kontak Pendaftar"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <div className="absolute bottom-full mb-1.5 right-0 hidden group-hover:flex items-center px-2 py-1 rounded bg-slate-950 text-[10px] font-bold text-white whitespace-nowrap shadow-2xl border border-slate-700 pointer-events-none z-30">
                                    Lihat Detail Profil &amp; Kontak Pendaftar
                                  </div>
                                </div>

                                {/* Tolak Pendaftaran */}
                                <div className="relative group">
                                  <button
                                    type="button"
                                    disabled={actionLoadingId === t.id}
                                    onClick={() => handleRejectTenant(t.id, t.ownerName)}
                                    className="p-1.5 bg-rose-950/60 hover:bg-rose-900/60 text-rose-400 border border-rose-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                    title="Tolak Pendaftaran Akun"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                  <div className="absolute bottom-full mb-1.5 right-0 hidden group-hover:flex items-center px-2 py-1 rounded bg-slate-950 text-[10px] font-bold text-white whitespace-nowrap shadow-2xl border border-slate-700 pointer-events-none z-30">
                                    Tolak Pendaftaran Akun
                                  </div>
                                </div>

                                {/* Setujui Akun */}
                                <div className="relative group">
                                  <button
                                    type="button"
                                    disabled={actionLoadingId === t.id}
                                    onClick={() => handleApproveTenant(t.id, t.ownerName)}
                                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-lg text-xs font-black shadow-md flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                                    title="Setujui pendaftaran dan aktifkan akses login Owner"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>{actionLoadingId === t.id ? '...' : 'Setujui'}</span>
                                  </button>
                                  <div className="absolute bottom-full mb-1.5 right-0 hidden group-hover:flex items-center px-2 py-1 rounded bg-slate-950 text-[10px] font-bold text-white whitespace-nowrap shadow-2xl border border-slate-700 pointer-events-none z-30">
                                    Setujui Pendaftaran Owner
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                {/* Quick Button: + Isi Kuota Token */}
                                <div className="relative group">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenSubModal(t)}
                                    className="px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-bold transition-all flex items-center gap-1 shadow-sm cursor-pointer active:scale-95"
                                    title="Tambah Kuota Token Transaksi (Top-Up)"
                                  >
                                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="hidden xl:inline">+ Isi Kuota</span>
                                  </button>
                                  <div className="absolute bottom-full mb-1.5 right-0 hidden group-hover:flex items-center px-2 py-1 rounded bg-slate-950 text-[10px] font-bold text-white whitespace-nowrap shadow-2xl border border-slate-700 pointer-events-none z-30">
                                    Tambah / Top-Up Kuota Token
                                  </div>
                                </div>

                                {/* 1. Lihat Profil Pemilik */}
                                <div className="relative group">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDetail(t.id)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition-colors cursor-pointer"
                                    title="Lihat Detail Profil & Kontak Pemilik"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  <div className="absolute bottom-full mb-1.5 right-0 hidden group-hover:flex items-center px-2 py-1 rounded bg-slate-950 text-[10px] font-bold text-white whitespace-nowrap shadow-2xl border border-slate-700 pointer-events-none z-30">
                                    Lihat Detail Profil &amp; Kontak Pemilik
                                  </div>
                                </div>

                                {/* 2. Lihat & Kelola Toko Owner (Buka Rincian Inline Tanpa Popup) */}
                                <div className="relative group">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleExpandStores(t.id)}
                                    className={`p-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                                      expandedOwnerId === t.id
                                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                                        : 'bg-indigo-950/60 hover:bg-indigo-900/60 text-indigo-300 border-indigo-800'
                                    }`}
                                    title={expandedOwnerId === t.id ? 'Tutup Daftar Toko' : `Lihat & Kelola ${outletsCount} Gerai F&B (Inline)`}
                                  >
                                    <Store className="w-3.5 h-3.5 text-indigo-400" />
                                    {outletsCount > 0 && (
                                      <span className="text-[10px] font-black px-1 rounded bg-indigo-800/80 text-white">
                                        {outletsCount}
                                      </span>
                                    )}
                                  </button>
                                  <div className="absolute bottom-full mb-1.5 right-0 hidden group-hover:flex items-center px-2 py-1 rounded bg-slate-950 text-[10px] font-bold text-white whitespace-nowrap shadow-2xl border border-slate-700 pointer-events-none z-30">
                                    {expandedOwnerId === t.id ? 'Tutup Daftar Gerai' : `Lihat & Kelola ${outletsCount} Gerai F&B (Inline)`}
                                  </div>
                                </div>

                                {/* 3. Toggle Status Akun Owner */}
                                <div className="relative group">
                                  <button
                                    type="button"
                                    disabled={actionLoadingId === t.id}
                                    onClick={() => handleToggleStatus(t.id, t.status, t.ownerName || t.name)}
                                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer disabled:opacity-50 ${
                                      isSuspended
                                        ? 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border-emerald-800'
                                        : 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-400 border-rose-800'
                                    }`}
                                    title={isSuspended ? 'Aktifkan Kembali Akun Owner' : 'Bekukan Akun (Semua Toko Akan Inaktif)'}
                                  >
                                    {actionLoadingId === t.id ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : isSuspended ? (
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                    ) : (
                                      <XCircle className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                  <div className="absolute bottom-full mb-1.5 right-0 hidden group-hover:flex items-center px-2 py-1 rounded bg-slate-950 text-[10px] font-bold text-white whitespace-nowrap shadow-2xl border border-slate-700 pointer-events-none z-30">
                                    {isSuspended ? 'Aktifkan Kembali Akun Owner' : 'Bekukan Akun (Semua Toko Akan Inaktif)'}
                                  </div>
                                </div>

                                {/* 4. Reset Password */}
                                <div className="relative group">
                                  <button
                                    type="button"
                                    disabled={actionLoadingId === t.id}
                                    onClick={() => handleResetPassword(t)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                    title="Reset Kata Sandi Akun Owner"
                                  >
                                    <KeyRound className="w-3.5 h-3.5" />
                                  </button>
                                  <div className="absolute bottom-full mb-1.5 right-0 hidden group-hover:flex items-center px-2 py-1 rounded bg-slate-950 text-[10px] font-bold text-white whitespace-nowrap shadow-2xl border border-slate-700 pointer-events-none z-30">
                                    Reset Kata Sandi Akun Owner
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Sub-baris Inline Toko Fisik (Accordion Drill-Down Tanpa Popup Bertumpuk) */}
                      {expandedOwnerId === t.id && (
                        <tr key={`${t.id}-expanded`} className="bg-slate-950/95 border-b border-indigo-900/40">
                          <td colSpan={6} className="p-4 sm:p-5">
                            <div className="bg-slate-900/90 border border-indigo-900/50 rounded-2xl p-4 sm:p-5 shadow-2xl animate-fade-in border-l-4 border-l-indigo-500">
                              {/* Header Accordion */}
                              <div className="flex items-center justify-between gap-3 pb-3 mb-4 border-b border-slate-800">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                                    <Store className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <h4 className="text-sm font-black text-white">
                                        Daftar Gerai Fisik F&amp;B Milik: {t.ownerName || t.name}
                                      </h4>
                                      {isSuspended ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1">
                                          <XCircle className="w-3 h-3 text-rose-400" />
                                          <span>AKUN OWNER INAKTIF</span>
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                          <span>AKUN OWNER AKTIF</span>
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-400 mt-0.5">
                                      Badan Usaha / Merchant: <span className="text-slate-200 font-semibold">{t.businessName || t.name}</span> &bull; {outletsCount} unit gerai terdaftar &bull; Kontak: {t.email} ({t.phone})
                                    </p>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setExpandedOwnerId(null)}
                                  className="px-2.5 py-1 rounded-lg text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                  <span>Tutup Rincian</span>
                                </button>
                              </div>

                              {/* Banner Kaskade jika Akun Owner INACTIVE */}
                              {isSuspended && (
                                <div className="mb-4 p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300 flex items-start gap-2.5">
                                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                                  <div>
                                    <strong className="font-bold block">Peringatan Kaskade Inaktif:</strong>
                                    <span>Akun pemilik sedang dibekukan (inaktif). Seluruh operasional gerai fisik di bawah akun ini otomatis dinonaktifkan dan transaksi kasir diblokir. Aktifkan akun pemilik di tabel utama untuk mengaktifkan kembali operasional gerai.</span>
                                  </div>
                                </div>
                              )}

                              {/* Outlets List */}
                              {!hasStore ? (
                                <div className="py-8 px-4 text-center bg-slate-950/50 border border-dashed border-slate-800 rounded-xl">
                                  <div className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center mx-auto mb-2 text-slate-500">
                                    <Store className="w-5 h-5" />
                                  </div>
                                  <h5 className="text-xs font-bold text-white">Belum Ada Unit Gerai Fisik</h5>
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    Pemilik ini belum menyelesaikan wizard setup gerai fisik pertamanya. Gerai akan muncul otomatis setelah pemilik login dan mengisi wizard.
                                  </p>
                                </div>
                              ) : (
                                <div className="grid grid-cols-1 gap-3">
                                  {t.outlets.map((outlet: any, idx: number) => {
                                    const isStoreInactive = isSuspended || !outlet.isActive;
                                    const isWarehouse = !!outlet.isWarehouse || outlet.name?.toLowerCase().includes('warehouse') || outlet.name?.toLowerCase().includes('gudang');

                                    return (
                                      <div
                                        key={outlet.id || idx}
                                        className={`p-3.5 rounded-xl border transition-all ${
                                          isStoreInactive
                                            ? 'bg-slate-950/80 border-rose-900/40 opacity-80'
                                            : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                                        }`}
                                      >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                          <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <span className="text-sm font-bold text-white flex items-center gap-1.5">
                                                <Store className={`w-4 h-4 ${isStoreInactive ? 'text-slate-500' : 'text-emerald-400'}`} />
                                                <span>{outlet.name}</span>
                                              </span>
                                              {outlet.merchantName && (
                                                <span className="text-xs text-slate-400">
                                                  ({outlet.merchantName})
                                                </span>
                                              )}
                                              {/* Outlet Mode Badge */}
                                              {isWarehouse ? (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-950/80 text-purple-300 border border-purple-700/60">
                                                  🏭 Gudang Bahan Baku
                                                </span>
                                              ) : (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-950/80 text-indigo-300 border border-indigo-700/60">
                                                  🍽️ Gerai Kasir F&amp;B
                                                </span>
                                              )}
                                            </div>
                                            <p className="text-xs text-slate-400 flex items-center gap-2">
                                              <span>Alamat: {outlet.address || 'Alamat fisik belum diisi'}</span>
                                              {outlet.phone && <span>&bull; Telp: {outlet.phone}</span>}
                                            </p>

                                            {/* Industries Chips */}
                                            {outlet.industries && Array.isArray(outlet.industries) && outlet.industries.length > 0 && (
                                              <div className="flex flex-wrap gap-1 pt-1">
                                                {outlet.industries.map((ind: string) => (
                                                  <span key={ind} className="px-2 py-0.5 rounded-md bg-indigo-950/60 text-indigo-300 text-[10px] font-medium border border-indigo-800/60">
                                                    {ind}
                                                  </span>
                                                ))}
                                              </div>
                                            )}
                                          </div>

                                          {/* Status & Actions */}
                                          <div className="flex items-center sm:flex-col sm:items-end justify-between gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                                            <div className="flex items-center gap-1.5 flex-wrap justify-end">
                                              {/* Token Model Badge */}
                                              <span className="px-2 py-0.5 rounded-md text-[10px] font-black border bg-amber-950/80 text-amber-300 border-amber-700/60 flex items-center gap-1">
                                                <Coins className="w-3 h-3 text-amber-400" />
                                                <span>Token Fleksibel</span>
                                              </span>

                                              {/* Store Status Badge */}
                                              {isStoreInactive ? (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center gap-1">
                                                  <XCircle className="w-3 h-3 text-rose-400" />
                                                  <span>INAKTIF</span>
                                                </span>
                                              ) : (
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center gap-1">
                                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                                  <span>AKTIF</span>
                                                </span>
                                              )}
                                            </div>

                                            {/* Action Buttons per store */}
                                            <div className="flex items-center gap-1.5 pt-1">
                                              {/* 1. Kelola Paket / Token Gerai */}
                                              <div className="relative group">
                                                <button
                                                  type="button"
                                                  onClick={() => handleOpenSubModal(t, outlet)}
                                                  className="p-1.5 bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800 rounded-lg transition-colors cursor-pointer"
                                                  title="Kelola Saldo & Paket Gerai Ini"
                                                >
                                                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                                                </button>
                                                <div className="absolute bottom-full mb-1.5 right-0 hidden group-hover:flex items-center px-2 py-1 rounded bg-slate-950 text-[10px] font-bold text-white whitespace-nowrap shadow-2xl border border-slate-700 pointer-events-none z-30">
                                                  Kelola Saldo &amp; Paket Gerai Ini
                                                </div>
                                              </div>

                                              {/* 2. Mode Inspeksi Toko */}
                                              <div className="relative group">
                                                <button
                                                  type="button"
                                                  disabled={actionLoadingId === `imp-${outlet.id}` || isStoreInactive}
                                                  onClick={() => handleImpersonate(t.id, outlet.id)}
                                                  className="p-1.5 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-800 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                                                  title="Masuk ke Backoffice / POS Toko Ini"
                                                >
                                                  <ExternalLink className="w-3.5 h-3.5" />
                                                </button>
                                                <div className="absolute bottom-full mb-1.5 right-0 hidden group-hover:flex items-center px-2 py-1 rounded bg-slate-950 text-[10px] font-bold text-white whitespace-nowrap shadow-2xl border border-slate-700 pointer-events-none z-30">
                                                  Masuk ke Backoffice / POS Toko Ini
                                                </div>
                                              </div>

                                              {/* 3. Toggle Status Toko */}
                                              <div className="relative group">
                                                <button
                                                  type="button"
                                                  disabled={actionLoadingId === outlet.id || isSuspended}
                                                  onClick={() => handleToggleOutletStatus(outlet.id, outlet.name, outlet.isActive ?? true)}
                                                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer disabled:opacity-40 ${
                                                    (outlet.isActive ?? true)
                                                      ? 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-400 border-rose-800'
                                                      : 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border-emerald-800'
                                                  }`}
                                                  title={(outlet.isActive ?? true) ? 'Nonaktifkan Toko Ini' : 'Aktifkan Toko Ini'}
                                                >
                                                  {actionLoadingId === outlet.id ? (
                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                  ) : (outlet.isActive ?? true) ? (
                                                    <XCircle className="w-3.5 h-3.5" />
                                                  ) : (
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                  )}
                                                </button>
                                                <div className="absolute bottom-full mb-1.5 right-0 hidden group-hover:flex items-center px-2 py-1 rounded bg-slate-950 text-[10px] font-bold text-white whitespace-nowrap shadow-2xl border border-slate-700 pointer-events-none z-30">
                                                  {(outlet.isActive ?? true) ? 'Nonaktifkan Toko Ini' : 'Aktifkan Toko Ini'}
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Merchant Card List View (Ergonomis Layar 6,8" Portrait) */}
          <div className="block lg:hidden space-y-3.5 my-4">
            {paginatedTenants.length === 0 ? (
              <div className="p-8 text-center text-slate-500 bg-slate-900 border border-slate-800 rounded-2xl text-xs">
                {loadingData ? 'Memuat data akun pemilik...' : 'Tidak ada data pendaftar yang cocok dengan filter.'}
              </div>
            ) : (
              paginatedTenants.map((t) => {
                const isPending = t.status === 'PENDING';
                const isSuspended = t.status === 'SUSPENDED';
                const outletsCount = t.outlets?.length || t._count?.outlets || 0;
                const primaryOutlet = t.outlets && t.outlets.length > 0 ? t.outlets[0] : null;
                const quota = calculateTenantTokenQuota(t);

                return (
                  <div
                    key={t.id}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm space-y-3.5"
                  >
                    {/* Header Kartu Merchant */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-md border border-white/10">
                          {(t.ownerName || 'OW').slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-white text-sm">{t.ownerName}</div>
                          <div className="text-xs font-semibold text-indigo-300 flex items-center gap-1">
                            <Store className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span className="truncate max-w-[180px]">{t.businessName || t.name}</span>
                          </div>
                        </div>
                      </div>

                      <div>
                        {isPending ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            PENDING
                          </span>
                        ) : isSuspended ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-300 border border-rose-500/20">
                            SUSPENDED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            ACTIVE
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Kuota Token Box */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Sisa Kuota Order</span>
                        <span className={`font-black text-xs flex items-center gap-1 ${
                          quota.quotaStatus === 'EMPTY' ? 'text-rose-400' : quota.quotaStatus === 'LOW' ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          <Zap className="w-3 h-3 fill-current" />
                          <span>{quota.remainingQuota.toLocaleString('id-ID')} Order</span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            quota.quotaStatus === 'EMPTY' ? 'bg-rose-500' : quota.quotaStatus === 'LOW' ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.max(5, 100 - quota.percentUsed)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>Paket: {t.subscriptionPlan?.name || 'Starter'}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleExpandStores(t.id)}
                          className="text-indigo-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span>{outletsCount} Gerai Fisik</span>
                          {expandedOwnerId === t.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>

                    {/* Accordion Gerai di Mobile */}
                    {expandedOwnerId === t.id && (
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-xs">
                        <span className="text-[10px] font-bold text-indigo-300 uppercase block">Daftar Gerai Toko:</span>
                        {(!t.outlets || t.outlets.length === 0) ? (
                          <p className="text-[11px] text-slate-500 italic">Belum ada gerai fisik terdaftar.</p>
                        ) : (
                          <div className="space-y-2">
                            {t.outlets.map((out: any) => (
                              <div key={out.id} className="p-2 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between text-[11px]">
                                <div>
                                  <span className="font-bold text-white block">{out.name}</span>
                                  <span className="text-[10px] text-slate-400">{out.address || 'Alamat —'}</span>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
                                  out.isActive ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}>
                                  {out.isActive ? 'AKTIF' : 'NONAKTIF'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Kontak Info */}
                    <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                      <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                        <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{t.ownerEmail}</span>
                      </div>
                      {t.ownerPhone && (
                        <span>📞 {t.ownerPhone}</span>
                      )}
                    </div>

                    {/* Action Buttons Toolbar */}
                    <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                      {isPending ? (
                        <>
                          <button
                            type="button"
                            disabled={actionLoadingId === t.id}
                            onClick={() => handleApproveTenant(t.id, t.ownerName)}
                            className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Setujui</span>
                          </button>
                          <button
                            type="button"
                            disabled={actionLoadingId === t.id}
                            onClick={() => handleRejectTenant(t.id, t.ownerName)}
                            className="py-2 px-3 rounded-xl bg-rose-950/60 hover:bg-rose-900/60 text-rose-400 border border-rose-800 text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Tolak</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleImpersonate(t.id, t.businessName || t.name)}
                            disabled={actionLoadingId === t.id || isSuspended}
                            className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-30"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>{actionLoadingId === t.id ? 'Loading...' : 'Inspeksi'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenSubModal(t, primaryOutlet)}
                            className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-slate-700 flex items-center justify-center gap-1 cursor-pointer"
                            title="Top-Up Kuota"
                          >
                            <Coins className="w-3.5 h-3.5 text-amber-400" />
                            <span>Top-Up</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleResetPassword(t)}
                            disabled={actionLoadingId === t.id}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer disabled:opacity-50"
                            title="Reset Password Owner"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            disabled={actionLoadingId === t.id}
                            onClick={() => handleToggleStatus(t.id, t.status, t.ownerName || t.name)}
                            className={`p-2 rounded-xl border cursor-pointer disabled:opacity-50 ${
                              isSuspended
                                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                                : 'bg-rose-950/60 border-rose-800 text-rose-400'
                            }`}
                            title={isSuspended ? 'Aktifkan' : 'Bekukan'}
                          >
                            {isSuspended ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {!loadingData && filteredTenants.length > 0 && (
            <TablePagination
              currentPage={safeTenantPage}
              pageSize={tenantPageSize}
              totalItems={filteredTenants.length}
              onPageChange={setTenantPage}
              onPageSizeChange={setTenantPageSize}
              pageSizeOptions={[10, 25, 50, 100]}
              itemLabel="merchant"
            />
          )}
        </section>
        );
      })()}

        {/* =========================================================================
            SECTION 3: MASTER PAKET KUOTA FLEKSIBEL (ENTERPRISE-LITE F&B)
        ========================================================================= */}
        {activeMainTab === 'PLANS' && (
          <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl space-y-8 animate-fade-in">
            {/* Header Banner */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 pb-6 border-b border-slate-800">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                    <Coins className="w-3 h-3 text-amber-400" />
                    <span>Model Kuota Pay-As-You-Go • F&amp;B Dynamic</span>
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                    <Infinity className="w-3 h-3 text-emerald-400" />
                    <span>100% Tanpa Hangus</span>
                  </span>
                </div>
                <h3 className="text-xl font-black text-white">Master Paket Kuota Fleksibel &amp; Layanan SaaS</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Struktur lisensi terdesentralisasi khusus bisnis F&amp;B (Resto, Cafe, Kedai Kopi, Roastery, dan Cloud Kitchen).
                  Merchant membayar <strong className="text-emerald-300">Biaya Setup Onboarding Rp 99.000 (+100 Bonus Token)</strong> di awal, lalu mengisi ulang kuota token pesanan kasir secara fleksibel tanpa ancaman hangus setiap akhir bulan.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const target = tenants.find((t) => t.status === 'ACTIVE') || tenants[0];
                    if (target) {
                      handleOpenSubModal(target);
                    }
                  }}
                  className="px-4 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black rounded-xl text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <Coins className="w-4 h-4 text-slate-950" />
                  <span>+ Top-Up Kuota Merchant</span>
                </button>
              </div>
            </div>

            {/* 4 Pillars of Enterprise-Lite Token Model */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-2.5">
                  <Coins className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white mb-1">Potong per Order Kasir</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  1 token terpakai otomatis setiap kali transaksi kasir selesai atau self-ordering QR berhasil dibayar.
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mb-2.5">
                  <Infinity className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white mb-1">Masa Berlaku Selamanya</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Sisa saldo token tidak pernah hangus di akhir bulan. Melindungi merchant dari beban operasional saat musim sepi.
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-2.5">
                  <CreditCard className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white mb-1">Setup Fee Rp 99.000 (+100 Token)</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Satu kali bayar di awal untuk provisioning database tenant, pairing printer thermal, aktivasi gerai perdana, dan bonus 100 token transaksi.
                </p>
              </div>

              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-2.5">
                  <Store className="w-4 h-4" />
                </div>
                <h4 className="text-xs font-bold text-white mb-1">F&amp;B Engine &amp; Gudang</h4>
                <p className="text-[11px] text-slate-400 leading-normal">
                  Mendukung Resep BOM pemotongan gramatur bahan baku otomatis, multi-outlet, dan mode gudang pasokan terpadu.
                </p>
              </div>
            </div>

            {/* Plan Cards Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-black text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  <span>Katalog Paket Kuota Pay-As-You-Go Aktif</span>
                </h4>
                <span className="text-xs text-slate-400">Pilih paket untuk alokasi dan simulasi ke akun merchant</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {plans.map((p) => {
                  const features = (p.features && typeof p.features === 'object') ? p.features : {};
                  const tokenQuota = features.tokenQuota || (p.code === 'PRO' ? 2000 : p.code === 'ENTERPRISE' ? 5000 : p.code === 'STARTER' ? 1000 : 500);
                  const isPopular = p.code === 'PRO' || features.isPopular;
                  const isScale = p.code === 'ENTERPRISE';
                  const costPerOrder = tokenQuota > 0 && p.price > 0 ? Math.round(Number(p.price) / tokenQuota) : 0;

                  return (
                    <div
                      key={p.id}
                      className={`p-5 rounded-2xl border transition-all flex flex-col justify-between relative ${
                        isPopular
                          ? 'bg-gradient-to-b from-indigo-950/60 to-slate-950 border-indigo-500/70 shadow-xl shadow-indigo-950/40 ring-1 ring-indigo-500/40'
                          : isScale
                          ? 'bg-gradient-to-b from-purple-950/40 to-slate-950 border-purple-800/60 shadow-lg'
                          : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {isPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md">
                          ⭐ Paling Diminati
                        </div>
                      )}

                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">
                            {p.code}
                          </span>
                          <span className="text-[10px] font-bold text-amber-300 flex items-center gap-0.5">
                            <Infinity className="w-3 h-3 text-amber-400" />
                            <span>Tanpa Hangus</span>
                          </span>
                        </div>

                        <h5 className="text-sm font-black text-white mb-2">{p.name}</h5>

                        {/* Token Callout */}
                        <div className="p-3 bg-slate-900/90 rounded-xl border border-slate-800/80 mb-4">
                          <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black text-amber-400">
                              {tokenQuota.toLocaleString('id-ID')}
                            </span>
                            <span className="text-xs font-bold text-slate-300">Token Order</span>
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[11px]">
                            <span className="text-white font-extrabold">
                              {p.price > 0 ? formatRupiah(p.price) : 'Gratis'}
                            </span>
                            {costPerOrder > 0 && (
                              <span className="text-emerald-400 font-bold">
                                Rp {costPerOrder} / order
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Limits & Features */}
                        <div className="space-y-2 text-xs text-slate-300 mb-6">
                          <div className="flex items-center gap-2">
                            <Store className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>Maksimal <strong className="text-white">{p.maxOutlets} Gerai</strong> F&amp;B / Gudang</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span>Maksimal <strong className="text-white">{p.maxCashiers} Kasir</strong> Aktif</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>Resep BOM &amp; Pemotongan Stok Bahan</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>Cetak Struk Thermal &amp; WhatsApp</span>
                          </div>
                          {p.code !== 'FREE' && (
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>Multi-Gudang &amp; Transfer Stok Pasokan</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const target = tenants.find((t) => t.status === 'ACTIVE') || tenants[0];
                          if (target) {
                            handleOpenSubModal(target);
                            setSelectedPlanId(p.id);
                          }
                        }}
                        className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${
                          isPopular
                            ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                        }`}
                      >
                        <Coins className="w-3.5 h-3.5 text-amber-300" />
                        <span>Suntik Paket ke Merchant</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Feature Matrix Table */}
            <div className="p-5 bg-slate-950 border border-slate-800 rounded-2xl">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Matriks Perbandingan Fitur Paket Enterprise-Lite F&amp;B</span>
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px]">
                      <th className="py-2.5 px-3">Fitur / Batasan Operasional</th>
                      <th className="py-2.5 px-3">Starter Trial (Gratis)</th>
                      <th className="py-2.5 px-3">Enterprise-Lite Starter</th>
                      <th className="py-2.5 px-3 text-indigo-300 font-black">Enterprise-Lite Growth ⭐</th>
                      <th className="py-2.5 px-3 text-purple-300 font-black">Enterprise-Lite Scale 🔥</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-white">Kuota Token Transaksi</td>
                      <td className="py-2.5 px-3 text-amber-400 font-bold">500 Order</td>
                      <td className="py-2.5 px-3 text-amber-400 font-bold">1.000 Order</td>
                      <td className="py-2.5 px-3 text-amber-400 font-black">2.000 Order</td>
                      <td className="py-2.5 px-3 text-amber-400 font-black">5.000 Order</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-white">Biaya per Order Selesai</td>
                      <td className="py-2.5 px-3 text-slate-400">Rp 0 (Trial)</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">Rp 99 / order</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">Rp 110 / order</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-black">Rp 90 / order (Termurah)</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-white">Masa Berlaku Kuota</td>
                      <td className="py-2.5 px-3 text-amber-300 font-bold">∞ Tanpa Hangus</td>
                      <td className="py-2.5 px-3 text-amber-300 font-bold">∞ Tanpa Hangus</td>
                      <td className="py-2.5 px-3 text-amber-300 font-bold">∞ Tanpa Hangus</td>
                      <td className="py-2.5 px-3 text-amber-300 font-bold">∞ Tanpa Hangus</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-white">Batas Gerai Fisik F&amp;B</td>
                      <td className="py-2.5 px-3">1 Gerai</td>
                      <td className="py-2.5 px-3">2 Gerai</td>
                      <td className="py-2.5 px-3 font-bold text-white">5 Gerai</td>
                      <td className="py-2.5 px-3 font-bold text-white">Unlimited Gerai</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-white">Batas Kasir Aktif</td>
                      <td className="py-2.5 px-3">2 Kasir</td>
                      <td className="py-2.5 px-3">5 Kasir</td>
                      <td className="py-2.5 px-3 font-bold text-white">20 Kasir</td>
                      <td className="py-2.5 px-3 font-bold text-white">Unlimited Kasir</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-white">Resep BOM &amp; Backflushing</td>
                      <td className="py-2.5 px-3 text-slate-500">Dasar</td>
                      <td className="py-2.5 px-3 text-emerald-400">✔ Aktif</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">✔ Aktif Otomatis</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">✔ Multi-Gudang Terpadu</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-semibold text-white">Self-Ordering QR Meja &amp; Mitra Delivery</td>
                      <td className="py-2.5 px-3 text-slate-500">-</td>
                      <td className="py-2.5 px-3 text-emerald-400">✔ Aktif</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">✔ Aktif (GoFood/Grab/Shopee)</td>
                      <td className="py-2.5 px-3 text-emerald-400 font-bold">✔ Prioritas Jalur Cepat</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* =========================================================================
            TAB 3: BUKU BESAR BILLING, INVOICE & MUTASI TOKEN TRANSAKSI (AUDIT LEDGER)
        ========================================================================= */}
        {activeMainTab === 'BILLING' && (() => {
          const paidInvoices = invoices.filter((i) => i.status === 'PAID');
          const totalRevenue = paidInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0);
          const totalTokensIssued = paidInvoices.reduce((sum, i) => sum + Number(i.tokenAmount || 0), 0);
          const unpaidCount = invoices.filter((i) => i.status !== 'PAID').length;
          const avgTicket = paidInvoices.length > 0 ? Math.round(totalRevenue / paidInvoices.length) : 0;

          const filteredInvoices = invoices.filter((inv) => {
            const matchesStatus =
              invoiceStatusFilter === 'ALL'
                ? true
                : invoiceStatusFilter === 'PAID'
                ? inv.status === 'PAID'
                : inv.status !== 'PAID';

            const query = invoiceSearchQuery.toLowerCase();
            const matchesSearch =
              !invoiceSearchQuery ||
              inv.invoiceNumber?.toLowerCase().includes(query) ||
              inv.tenant?.name?.toLowerCase().includes(query) ||
              inv.tenant?.businessName?.toLowerCase().includes(query) ||
              inv.tenant?.owner?.name?.toLowerCase().includes(query) ||
              inv.notes?.toLowerCase().includes(query);

            return matchesStatus && matchesSearch;
          });

          const invoiceTotalPages = Math.max(1, Math.ceil(filteredInvoices.length / invoicePageSize));
          const safeInvoicePage = Math.min(Math.max(1, invoicePage), invoiceTotalPages);
          const paginatedInvoices = filteredInvoices.slice(
            (safeInvoicePage - 1) * invoicePageSize,
            safeInvoicePage * invoicePageSize
          );

          return (
            <section className="space-y-6 animate-fade-in">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Receipt className="w-6 h-6 text-indigo-400" />
                    <h2 className="text-xl font-black text-white">Buku Besar Billing, Faktur &amp; Mutasi Token</h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Rekonsiliasi arus kas masuk lisensi SaaS, mutasi saldo Pay-As-You-Go, dan penerbitan faktur digital resmi.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleOpenPaymentConfigModal}
                    className="inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-sm"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Kelola QRIS &amp; Rekening Platform</span>
                  </button>
                  <button
                    type="button"
                    onClick={loadPlatformData}
                    className="inline-flex items-center gap-2 px-3 py-2 bg-slate-900 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Segarkan Ledger</span>
                  </button>
                </div>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Total Kas Masuk (Lunas)</span>
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-black text-emerald-400">{formatRupiah(totalRevenue)}</div>
                  <span className="text-[10px] text-slate-500 mt-1 block">Dari {paidInvoices.length} transaksi faktur berhasil</span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Total Token Diterbitkan</span>
                    <Coins className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-black text-amber-400">
                    +{totalTokensIssued.toLocaleString('id-ID')}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">Termasuk starter pack &amp; kuota top-up</span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Faktur Menunggu Bayar</span>
                    <Clock className="w-4 h-4 text-rose-400" />
                  </div>
                  <div className="text-2xl font-black text-white">{unpaidCount}</div>
                  <span className="text-[10px] text-slate-500 mt-1 block">Memerlukan verifikasi transfer</span>
                </div>

                <div className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider">Rata-rata Nilai Faktur</span>
                    <TrendingUp className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl font-black text-indigo-300">{formatRupiah(avgTicket)}</div>
                  <span className="text-[10px] text-slate-500 mt-1 block">ARPU Pay-As-You-Go per merchant</span>
                </div>
              </div>

              {/* Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/50 p-3 rounded-2xl border border-slate-800">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={invoiceSearchQuery}
                    onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                    placeholder="Cari nomor invoice (INV-...), nama merchant, atau pemilik..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-semibold whitespace-nowrap">Filter Status:</span>
                  {(['ALL', 'PAID', 'UNPAID'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setInvoiceStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        invoiceStatusFilter === st
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {st === 'ALL' ? 'Semua Faktur' : st === 'PAID' ? '✔ Lunas' : '⏳ Belum Lunas'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Invoices Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs text-slate-300">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] text-slate-400 uppercase font-black tracking-wider">
                        <th className="py-3.5 px-4">No. Faktur</th>
                        <th className="py-3.5 px-4">Klien Merchant</th>
                        <th className="py-3.5 px-4">Tanggal Penerbitan</th>
                        <th className="py-3.5 px-4">Rincian Item &amp; Token</th>
                        <th className="py-3.5 px-4">Kupon Promo</th>
                        <th className="py-3.5 px-4 text-right">Nominal Tagihan</th>
                        <th className="py-3.5 px-4 text-center">Status</th>
                        <th className="py-3.5 px-4 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-medium">
                      {paginatedInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-slate-500">
                            Tidak ada transaksi faktur yang cocok dengan pencarian.
                          </td>
                        </tr>
                      ) : (
                        paginatedInvoices.map((inv) => {
                          const isPaid = inv.status === 'PAID';
                          return (
                            <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                              <td className="py-3.5 px-4">
                                <button
                                  type="button"
                                  onClick={() => setSelectedInvoiceModal(inv)}
                                  className="font-mono font-black text-indigo-400 hover:text-indigo-300 hover:underline flex items-center gap-1.5 cursor-pointer"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>{inv.invoiceNumber}</span>
                                </button>
                                <span className="text-[10px] text-slate-500 block mt-0.5">
                                  Via {inv.paymentMethod || 'Manual Transfer'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className="font-bold text-white block">
                                  {inv.tenant?.name || inv.tenant?.businessName || 'Tenant'}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Owner: {inv.tenant?.owner?.name || '-'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 whitespace-nowrap text-slate-400">
                                {new Date(inv.issuedAt || inv.createdAt).toLocaleDateString('id-ID', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                                <span className="text-[10px] text-slate-500 block">
                                  {new Date(inv.issuedAt || inv.createdAt).toLocaleTimeString('id-ID', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })} WIB
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-slate-200">{inv.notes || 'Biaya Layanan SaaS'}</span>
                                </div>
                                {inv.tokenAmount > 0 && (
                                  <span className="text-[10px] font-bold text-amber-300 flex items-center gap-1 mt-0.5">
                                    <Coins className="w-3 h-3 text-amber-400" />
                                    <span>+{Number(inv.tokenAmount).toLocaleString('id-ID')} Token Order</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4">
                                {inv.promoCode ? (
                                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-[10px] font-black text-indigo-300">
                                    <Tag className="w-3 h-3" />
                                    <span>{inv.promoCode}</span>
                                  </div>
                                ) : (
                                  <span className="text-slate-600 text-[11px]">-</span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <span className="font-black text-white text-sm block">
                                  {formatRupiah(Number(inv.amount))}
                                </span>
                                {inv.discountAmount > 0 && (
                                  <span className="text-[10px] text-emerald-400 font-semibold block">
                                    Hemat {formatRupiah(Number(inv.discountAmount))}
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                                  isPaid
                                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                                    : 'bg-amber-950/80 text-amber-300 border-amber-800 animate-pulse'
                                }`}>
                                  {isPaid ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Clock className="w-3 h-3 text-amber-400" />}
                                  <span>{isPaid ? 'LUNAS' : 'MENUNGGU'}</span>
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedInvoiceModal(inv)}
                                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs transition-colors cursor-pointer"
                                    title="Buka Faktur Digital"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </button>
                                  {!isPaid && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          const res = await api.verifyPlatformInvoicePayment(inv.id, 'MANUAL_VERIFIED');
                                          if (res.status === 'success') {
                                            setActionFeedback(`Invoice ${inv.invoiceNumber} berhasil diverifikasi Lunas.`);
                                            await loadPlatformData();
                                          }
                                        } catch (e: any) {
                                          showAlert('Gagal Verifikasi', e.message, 'error');
                                        }
                                      }}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer shadow"
                                    >
                                      Verifikasi Lunas
                                    </button>
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

                {filteredInvoices.length > 0 && (
                  <TablePagination
                    currentPage={safeInvoicePage}
                    pageSize={invoicePageSize}
                    totalItems={filteredInvoices.length}
                    onPageChange={setInvoicePage}
                    onPageSizeChange={setInvoicePageSize}
                    pageSizeOptions={[10, 25, 50, 100]}
                    itemLabel="faktur"
                  />
                )}
              </div>
            </section>
          );
        })()}

        {/* =========================================================================
            TAB 4: MANAJEMEN TIM STAF PLATFORM & RBAC CONTROL TOWER
        ========================================================================= */}
        {activeMainTab === 'STAFF' && (() => {
          const staffTotalPages = Math.max(1, Math.ceil(platformUsers.length / staffPageSize));
          const safeStaffPage = Math.min(Math.max(1, staffPage), staffTotalPages);
          const paginatedStaff = platformUsers.slice(
            (safeStaffPage - 1) * staffPageSize,
            safeStaffPage * staffPageSize
          );

          return (
            <section className="space-y-6 animate-fade-in">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                <div className="flex items-center gap-2">
                  <Users className="w-6 h-6 text-indigo-400" />
                  <h2 className="text-xl font-black text-white">Manajemen Tim Staf Platform &amp; RBAC</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Kontrol akses dan pembagian wewenang operasional internal Well POS HQ (Super Admin, Tim Billing &amp; Tim Support).
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCreateStaffModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Tambah Staf Baru</span>
              </button>
            </div>

            {/* Role Matrix Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">SUPER_ADMIN</h4>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Akses tertinggi tanpa batasan: persetujuan onboarding merchant, modifikasi paket langganan, manajemen staf HQ, dan buku besar.
                </p>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">BILLING</h4>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Fokus keuangan: verifikasi bukti transfer masuk, cetak invoice digital, serta penerbitan kupon diskon dan top-up kuota token.
                </p>
              </div>

              <div className="bg-slate-900/70 border border-slate-800 p-4 rounded-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">SUPPORT</h4>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Bantuan operasional harian: reset sandi merchant darurat, pemantauan status kuota menipis, dan panduan teknis operasional.
                </p>
              </div>
            </div>

            {/* Staff List Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs text-slate-300">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/70 text-[11px] text-slate-400 uppercase font-black tracking-wider">
                      <th className="py-3.5 px-4">Nama Staf</th>
                      <th className="py-3.5 px-4">Email Login</th>
                      <th className="py-3.5 px-4">Peran (Role RBAC)</th>
                      <th className="py-3.5 px-4">Waktu Terdaftar</th>
                      <th className="py-3.5 px-4 text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {paginatedStaff.map((user) => {
                      const isRootAdmin = user.email === 'superadmin@wellpos.id';
                      return (
                        <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-300 font-black flex items-center justify-center border border-indigo-500/30 text-xs">
                                {user.name?.charAt(0)?.toUpperCase() || 'U'}
                              </div>
                              <div>
                                <span className="font-bold text-white block">{user.name}</span>
                                {isRootAdmin && (
                                  <span className="text-[9px] font-bold text-rose-400 uppercase">
                                    ★ Root SuperAdmin
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-slate-300 font-mono text-[11px]">{user.email}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase ${
                              user.role === 'SUPER_ADMIN'
                                ? 'bg-rose-950/70 text-rose-300 border-rose-800'
                                : user.role === 'BILLING'
                                ? 'bg-amber-950/70 text-amber-300 border-amber-800'
                                : 'bg-indigo-950/70 text-indigo-300 border-indigo-800'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-400">
                            {new Date(user.createdAt).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {isRootAdmin ? (
                              <span className="text-[10px] text-slate-600 font-bold italic">Terkunci (Root)</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDeleteStaff(user)}
                                className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs transition-colors cursor-pointer"
                                title="Cabut Akses Staf"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {platformUsers.length > 0 && (
                <TablePagination
                  currentPage={safeStaffPage}
                  pageSize={staffPageSize}
                  totalItems={platformUsers.length}
                  onPageChange={setStaffPage}
                  onPageSizeChange={setStaffPageSize}
                  pageSizeOptions={[10, 25, 50, 100]}
                  itemLabel="staf"
                />
              )}
            </div>
          </section>
          );
        })()}

        {/* =========================================================================
            TAB 5: MANAJEMEN PROMO SAAS PLATFORM (B2B VOUCHER ENGINE)
        ========================================================================= */}
        {activeMainTab === 'PROMOS' && (() => {
          const promoTotalPages = Math.max(1, Math.ceil(promos.length / promoPageSize));
          const safePromoPage = Math.min(Math.max(1, promoPage), promoTotalPages);
          const paginatedPromos = promos.slice(
            (safePromoPage - 1) * promoPageSize,
            safePromoPage * promoPageSize
          );

          return (
            <section className="space-y-6 animate-fade-in">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Tag className="w-6 h-6 text-indigo-400" />
                    <h2 className="text-xl font-black text-white">Manajemen Promo SaaS Platform (B2B Engine)</h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Penerbitan kupon diskon onboarding, potongan harga setup fee, dan bonus kuota token bagi merchant F&amp;B.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCreatePromoModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <Tag className="w-4 h-4" />
                  <span>+ Buat Promo Baru</span>
                </button>
              </div>

              {/* Difference notice banner */}
              <div className="p-3.5 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl flex items-start gap-3 text-xs text-indigo-200">
                <Sparkles className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold text-white">Perbedaan Kupon Platform Level-1 vs Menu Toko Level-2</p>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    Kupon di sini berlaku khusus untuk transaksi lisensi B2B antara <strong>Well POS HQ</strong> dan <strong>Pemilik Merchant</strong> (diskon setup fee / bonus token transaksi). Promo menu makanan dan minuman kasir toko diatur mandiri oleh merchant di menu Backoffice Toko.
                  </p>
                </div>
              </div>

              {/* Grid Kartu Promo */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedPromos.map((promo) => {
                const isExpired = promo.validUntil && new Date(promo.validUntil) < new Date();
                const isLimitReached = promo.usageLimit && promo.usedCount >= promo.usageLimit;

                return (
                  <div
                    key={promo.id}
                    className={`bg-slate-900 border rounded-3xl p-5 relative overflow-hidden transition-all flex flex-col justify-between ${
                      promo.isActive
                        ? 'border-slate-800 hover:border-slate-700 shadow-xl'
                        : 'border-slate-800/40 opacity-60 bg-slate-950'
                    }`}
                  >
                    <div>
                      {/* Top bar */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm px-2.5 py-1 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 tracking-wider">
                            {promo.code}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(promo.code)}
                            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title="Salin Kode Kupon"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase ${
                          !promo.isActive
                            ? 'bg-slate-800 text-slate-400 border-slate-700'
                            : isExpired
                            ? 'bg-rose-950 text-rose-300 border-rose-800'
                            : isLimitReached
                            ? 'bg-amber-950 text-amber-300 border-amber-800'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        }`}>
                          {!promo.isActive ? 'NONAKTIF' : isExpired ? 'KEDALUWARSA' : isLimitReached ? 'LIMIT HABIS' : 'AKTIF'}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <h4 className="text-sm font-black text-white">{promo.name}</h4>
                      <div className="mt-2 p-2.5 bg-slate-950 rounded-xl border border-slate-800/80 flex items-center justify-between">
                        <span className="text-[11px] text-slate-400">Benefit Kupon:</span>
                        <span className="font-black text-xs text-emerald-400">
                          {promo.type === 'DISCOUNT_PERCENT'
                            ? `Diskon ${promo.value}%`
                            : promo.type === 'DISCOUNT_FIXED'
                            ? `Potongan ${formatRupiah(promo.value)}`
                            : `Bonus +${Number(promo.value).toLocaleString('id-ID')} Token Order`}
                        </span>
                      </div>

                      {/* Details */}
                      <div className="mt-3 space-y-1.5 text-[11px] text-slate-400">
                        {promo.minSpend > 0 && (
                          <div className="flex justify-between">
                            <span>Min. Transaksi:</span>
                            <span className="text-slate-200 font-semibold">{formatRupiah(promo.minSpend)}</span>
                          </div>
                        )}
                        {promo.maxDiscount > 0 && (
                          <div className="flex justify-between">
                            <span>Maks. Potongan:</span>
                            <span className="text-slate-200 font-semibold">{formatRupiah(promo.maxDiscount)}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Pemakaian Kuota:</span>
                          <span className="text-slate-200 font-semibold">
                            {promo.usedCount} / {promo.usageLimit ? `${promo.usageLimit} kali` : '∞ Tanpa Batas'}
                          </span>
                        </div>
                        {promo.validUntil && (
                          <div className="flex justify-between">
                            <span>Berlaku Hingga:</span>
                            <span className="text-slate-200 font-semibold">
                              {new Date(promo.validUntil).toLocaleDateString('id-ID', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="mt-5 pt-3 border-t border-slate-800/70 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleTogglePromo(promo)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          promo.isActive
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                            : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500'
                        }`}
                      >
                        {promo.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePromo(promo)}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg text-xs transition-colors cursor-pointer"
                        title="Hapus Promo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {promos.length > 0 && (
              <TablePagination
                currentPage={safePromoPage}
                pageSize={promoPageSize}
                totalItems={promos.length}
                onPageChange={setPromoPage}
                onPageSizeChange={setPromoPageSize}
                pageSizeOptions={[10, 25, 50, 100]}
                itemLabel="kupon promo"
              />
            )}
          </section>
          );
        })()}
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
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl font-black text-white">
                        {selectedTenantDetail.owner?.name || selectedTenantDetail.tenant.businessName}
                      </span>
                      {selectedTenantDetail.tenant.status === 'PENDING' && (
                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 animate-pulse">
                          ⏳ MENUNGGU APPROVAL
                        </span>
                      )}
                      {selectedTenantDetail.tenant.status === 'ACTIVE' && (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                          ✅ AKTIF (DISETUJUI)
                        </span>
                      )}
                      {selectedTenantDetail.tenant.status === 'SUSPENDED' && (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400">
                          🚫 DIBEKUKAN
                        </span>
                      )}
                      {selectedTenantDetail.tenant.status === 'CANCELLED' && (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-400">
                          ❌ DITOLAK / DIBATALKAN
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedTenantDetail.tenant.status === 'PENDING'
                      ? 'Pendaftaran Akun Pemilik • Belum Memiliki Toko Fisik'
                      : selectedTenantDetail.outlets && selectedTenantDetail.outlets.length > 0
                      ? `${selectedTenantDetail.outlets[0].name} • ${selectedTenantDetail.outlets.length} Gerai Fisik Terdaftar`
                      : 'Akun Disetujui • Menunggu Penyelesaian Setup Toko'}
                  </p>
                </div>

                {/* Banner Khusus Akun PENDING */}
                {selectedTenantDetail.tenant.status === 'PENDING' && (
                  <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5">
                      <Clock className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
                      <div>
                        <p className="font-bold text-amber-200">Akun Menunggu Persetujuan SuperAdmin</p>
                        <p className="text-amber-400/80 text-[11px] mt-0.5">
                          Calon pemilik belum dapat masuk ke dashboard sampai Superadmin memberikan persetujuan.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                      <button
                        type="button"
                        disabled={actionLoadingId === selectedTenantDetail.tenant.id}
                        onClick={() =>
                          handleRejectTenant(
                            selectedTenantDetail.tenant.id,
                            selectedTenantDetail.owner?.name || selectedTenantDetail.tenant.businessName
                          )
                        }
                        className="flex-1 sm:flex-none px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-xl font-bold transition-all text-center"
                      >
                        Tolak
                      </button>
                      <button
                        type="button"
                        disabled={actionLoadingId === selectedTenantDetail.tenant.id}
                        onClick={() =>
                          handleApproveTenant(
                            selectedTenantDetail.tenant.id,
                            selectedTenantDetail.owner?.name || selectedTenantDetail.tenant.businessName
                          )
                        }
                        className="flex-1 sm:flex-none px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black shadow-md flex items-center justify-center gap-1.5 transition-all"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Setujui Akun</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Section: Kontak Owner & Aksi Cepat */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Kontak Pemilik (Owner) Bisnis</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Nama Lengkap Pemilik:</span>
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
                      <p className="text-slate-200 mt-0.5 font-mono">
                        {selectedTenantDetail.owner?.phone && selectedTenantDetail.owner.phone !== '-'
                          ? selectedTenantDetail.owner.phone
                          : selectedTenantDetail.tenant?.phone && selectedTenantDetail.tenant.phone !== '-'
                          ? selectedTenantDetail.tenant.phone
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Status Verifikasi Akun:</span>
                      {selectedTenantDetail.tenant.status === 'PENDING' ? (
                        <span className="text-amber-400 font-bold mt-0.5 inline-block">⏳ Menunggu Persetujuan</span>
                      ) : selectedTenantDetail.tenant.status === 'ACTIVE' ? (
                        <span className="text-emerald-400 font-bold mt-0.5 inline-block">✅ Terverifikasi &amp; Aktif</span>
                      ) : selectedTenantDetail.tenant.status === 'SUSPENDED' ? (
                        <span className="text-rose-400 font-bold mt-0.5 inline-block">🚫 Akses Dibekukan</span>
                      ) : (
                        <span className="text-slate-400 font-bold mt-0.5 inline-block">❌ Pendaftaran Ditolak</span>
                      )}
                    </div>
                  </div>

                  {/* Actions for owner */}
                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
                    {/* WhatsApp Direct Link */}
                    {((selectedTenantDetail.owner?.phone && selectedTenantDetail.owner.phone !== '-') ||
                      (selectedTenantDetail.tenant?.phone && selectedTenantDetail.tenant.phone !== '-')) && (
                      <a
                        href={`https://wa.me/${cleanPhoneForWa(
                          selectedTenantDetail.owner?.phone && selectedTenantDetail.owner.phone !== '-'
                            ? selectedTenantDetail.owner.phone
                            : selectedTenantDetail.tenant.phone
                        )}?text=${encodeURIComponent(
                          selectedTenantDetail.tenant.status === 'PENDING'
                            ? `Halo ${selectedTenantDetail.owner?.name || 'Pemilik'}, kami dari Tim Operasional Well POS ingin memverifikasi pengajuan pendaftaran akun bisnis Anda...`
                            : `Halo ${selectedTenantDetail.owner?.name || 'Pemilik'}, kami dari Tim Support Well POS menginformasikan perihal layanan POS toko Anda...`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Chat WhatsApp</span>
                      </a>
                    )}

                    {selectedTenantDetail.tenant.status !== 'PENDING' && (
                      <>
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

                        {/* Impersonate button (only if store exists) */}
                        {selectedTenantDetail.outlets && selectedTenantDetail.outlets.length > 0 && (
                          <button
                            type="button"
                            onClick={() =>
                              handleImpersonate(
                                selectedTenantDetail.tenant.id,
                                selectedTenantDetail.tenant.businessName
                              )
                            }
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ml-auto"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Buka Toko Ini</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Section: Outlet Toko */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Store className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Daftar Gerai / Toko Fisik ({selectedTenantDetail.outlets.length})</span>
                    </div>
                    {selectedTenantDetail.outlets.length === 0 && (
                      <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-800/60">
                        Belum Ada Toko
                      </span>
                    )}
                  </h4>

                  {selectedTenantDetail.outlets.length === 0 ? (
                    <div className="p-5 bg-slate-950 border border-slate-800/80 rounded-2xl text-center space-y-1.5">
                      <div className="w-9 h-9 rounded-full bg-slate-800/80 text-slate-400 flex items-center justify-center mx-auto mb-1">
                        <Store className="w-4 h-4" />
                      </div>
                      <p className="text-xs font-bold text-slate-300">Belum Ada Toko Fisik Didaftarkan</p>
                      <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                        {selectedTenantDetail.tenant.status === 'PENDING'
                          ? 'Akun masih menunggu persetujuan SuperAdmin. Toko fisik pertama akan dibuat saat Owner login pertama kali.'
                          : 'Owner telah disetujui namun belum menyelesaikan wizard setup toko perdana (Nama Pedagang, Nama Toko, Alamat, dan Multi-Industri).'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {selectedTenantDetail.outlets.map((o: any) => (
                        <div
                          key={o.id}
                          className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-xs">{o.name}</span>
                                <span className="text-[9px] px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 font-bold border border-emerald-500/20">
                                  Aktif
                                </span>
                              </div>
                              {o.merchantName && (
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                  Badan Usaha / Legal:{' '}
                                  <span className="text-slate-200 font-semibold">{o.merchantName}</span>
                                </p>
                              )}
                              <p className="text-[11px] text-slate-400 mt-0.5">{o.address || 'Alamat belum diatur'}</p>
                            </div>
                            <span className="text-slate-400 font-mono text-[11px] shrink-0">{o.phone || '-'}</span>
                          </div>

                          {o.industries && Array.isArray(o.industries) && o.industries.length > 0 && (
                            <div className="pt-2 border-t border-slate-900 flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] text-slate-500 font-medium">Sektor Industri:</span>
                              {o.industries.map((ind: string) => (
                                <span
                                  key={ind}
                                  className="px-2 py-0.5 rounded-md bg-indigo-950/80 text-indigo-300 text-[10px] font-semibold border border-indigo-800"
                                >
                                  {ind}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section: Statistik Toko (Hanya jika toko sudah ada) */}
                {selectedTenantDetail.outlets.length > 0 && (
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
                        <span className="text-[11px] text-slate-500 block">Outlet / Toko</span>
                        <p className="text-sm font-black text-white mt-0.5">
                          {selectedTenantDetail.stats.totalOutlets} Toko
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Section: Status Paket Langganan (Per Toko Fisik) */}
                <div className="p-4 bg-indigo-950/40 border border-indigo-900/60 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-bold text-indigo-300 block uppercase tracking-wider">
                        Paket Langganan (Per Toko Fisik)
                      </span>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Langganan paket Well POS berlaku per unit toko fisik, bukan per akun pemilik.
                      </p>
                    </div>
                  </div>

                  {selectedTenantDetail.outlets.length === 0 ? (
                    <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-center space-y-1">
                      <p className="text-xs font-semibold text-slate-300">Belum Ada Toko yang Didaftarkan</p>
                      <p className="text-[11px] text-slate-500">
                        Paket langganan akan ditentukan dan aktif untuk masing-masing toko setelah owner menyelesaikan setup toko.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedTenantDetail.outlets.map((o: any) => {
                        const planName =
                          o.subscription?.planName ||
                          selectedTenantDetail.currentSubscription?.planName ||
                          'PRO Trial (14 Hari)';
                        return (
                          <div
                            key={o.id}
                            className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <Store className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="font-bold text-white">{o.name}</span>
                              </div>
                              <p className="text-slate-400 text-[11px]">
                                Paket Aktif: <span className="font-semibold text-indigo-300">{planName}</span>
                                {selectedTenantDetail.tenant.trialEndsAt && (
                                  <span className="text-slate-500 ml-1.5 font-mono">
                                    (s/d {new Date(selectedTenantDetail.tenant.trialEndsAt).toLocaleDateString('id-ID')})
                                  </span>
                                )}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setDetailModalOpen(false);
                                handleOpenSubModal(selectedTenantDetail.tenant);
                              }}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-lg transition-all flex items-center gap-1 shrink-0"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Ubah Paket</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: UBAH PAKET & TOP-UP KUOTA TOKEN TRANSAKSI (PAY-AS-YOU-GO)
      ========================================================================= */}
      {subModalOpen && subTenantTarget && (() => {
        const currentQuota = calculateTenantTokenQuota(subTenantTarget);
        const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];
        const selectedPlanFeatures = (selectedPlan?.features && typeof selectedPlan.features === 'object') ? (selectedPlan.features as any) : {};
        const planTokenAmount = selectedPlanFeatures.tokenQuota || (selectedPlan?.code === 'PRO' ? 2000 : selectedPlan?.code === 'ENTERPRISE' ? 5000 : selectedPlan?.code === 'STARTER' ? 1000 : 500);

        const activeSelectedPromo = promos.find((p) => p.code === topUpPromoCode && p.isActive);
        const rawCost = topUpMode === 'CUSTOM' ? customTokenAmount * 110 : Number(selectedPlan?.price || 0);
        let promoDiscount = 0;
        let bonusTokenVal = 0;
        if (activeSelectedPromo) {
          if (activeSelectedPromo.type === 'DISCOUNT_PERCENT') {
            const rawDisc = (rawCost * activeSelectedPromo.value) / 100;
            promoDiscount = activeSelectedPromo.maxDiscount ? Math.min(rawDisc, activeSelectedPromo.maxDiscount) : rawDisc;
          } else if (activeSelectedPromo.type === 'DISCOUNT_FIXED') {
            promoDiscount = Math.min(rawCost, activeSelectedPromo.value);
          } else if (activeSelectedPromo.type === 'BONUS_TOKENS') {
            bonusTokenVal = activeSelectedPromo.value;
          }
        }
        const finalPayable = Math.max(0, rawCost - promoDiscount);
        const baseAddedTokens = topUpMode === 'CUSTOM' ? customTokenAmount : planTokenAmount;
        const addedTokens = baseAddedTokens + bonusTokenVal;
        const projectedNewTotal = currentQuota.remainingQuota + addedTokens;
        const estimatedCustomPrice = customTokenAmount * 110;

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-5 sm:p-7 shadow-2xl relative text-slate-200 max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
              <button
                type="button"
                onClick={() => setSubModalOpen(false)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all cursor-pointer z-10"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="text-center mb-4 shrink-0 pr-8">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto mb-2 shadow-md">
                  <Coins className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <h3 className="text-lg sm:text-xl font-black text-white">Top-Up Saldo Kuota Token Transaksi</h3>
                <p className="text-xs text-slate-400 mt-0.5 truncate">
                  Merchant: <strong className="text-white">{subTenantTarget.businessName || subTenantTarget.name}</strong>
                  {subOutletTarget && <span className="text-indigo-300 font-bold ml-1">• Gerai: {subOutletTarget.name}</span>}
                </p>
              </div>

              {/* Current Quota Status Banner */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl mb-3 flex items-center justify-between shrink-0">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Saldo Saat Ini</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-base sm:text-lg font-black text-amber-400">
                      {currentQuota.remainingQuota.toLocaleString('id-ID')} Token
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border ${
                      currentQuota.quotaStatus === 'SAFE'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                        : currentQuota.quotaStatus === 'LOW'
                        ? 'bg-amber-950 text-amber-300 border-amber-800'
                        : 'bg-rose-950 text-rose-300 border-rose-800'
                    }`}>
                      {currentQuota.quotaStatus === 'SAFE' ? 'AMAN' : currentQuota.quotaStatus === 'LOW' ? 'MENIPIS' : 'HABIS'}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Order Terproses</span>
                  <div className="text-xs font-bold text-white mt-0.5 flex items-center justify-end gap-1">
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                    <span>{currentQuota.usedOrders.toLocaleString('id-ID')} Struk</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmitSubscription} className="flex-1 flex flex-col overflow-hidden">
                <div className="overflow-y-auto overscroll-contain flex-1 pr-1 space-y-3.5 pb-3">
                {/* Mode Selector Tabs */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      type="button"
                      onClick={() => setTopUpMode('PACKAGES')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        topUpMode === 'PACKAGES'
                          ? 'bg-indigo-600 text-white border-indigo-500 shadow-md'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      🏷️ Pilihan Paket Instan
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopUpMode('CUSTOM')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        topUpMode === 'CUSTOM'
                          ? 'bg-amber-600 text-white border-amber-500 shadow-md'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      ✏️ Kustom Jumlah Token
                    </button>
                  </div>

                  {/* Mode 1: Pilihan Paket Instan */}
                  {topUpMode === 'PACKAGES' ? (
                    <div className="space-y-2">
                      {plans.map((p) => {
                        const isSelected = selectedPlanId === p.id;
                        const features = (p.features && typeof p.features === 'object') ? p.features : {};
                        const tokens = features.tokenQuota || (p.code === 'PRO' ? 2000 : p.code === 'ENTERPRISE' ? 5000 : p.code === 'STARTER' ? 1000 : 500);
                        const costPerOrder = tokens > 0 && p.price > 0 ? Math.round(Number(p.price) / tokens) : 0;

                        return (
                          <div
                            key={p.id}
                            onClick={() => setSelectedPlanId(p.id)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                              isSelected
                                ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-md ring-1 ring-indigo-500/50'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                isSelected ? 'border-indigo-400 bg-indigo-600' : 'border-slate-700'
                              }`}>
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                              <div>
                                <p className="font-bold text-xs text-white flex items-center gap-1.5">
                                  <span>{p.name}</span>
                                  {p.code === 'PRO' && (
                                    <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[9px] font-black uppercase">
                                      Populer
                                    </span>
                                  )}
                                </p>
                                <p className="text-[11px] text-amber-300/90 font-medium">
                                  +{tokens.toLocaleString('id-ID')} Token Order &bull; Maks. {p.maxOutlets} Toko
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-black text-xs text-indigo-300 block">
                                {p.price > 0 ? formatRupiah(p.price) : 'Gratis'}
                              </span>
                              {costPerOrder > 0 && (
                                <span className="text-[10px] text-emerald-400 font-semibold">
                                  Rp {costPerOrder}/order
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Mode 2: Kustom Jumlah Token */
                    <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-300 mb-1.5">
                          Masukkan Jumlah Token Kuota Order:
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            min="100"
                            step="100"
                            value={customTokenAmount}
                            onChange={(e) => setCustomTokenAmount(Math.max(100, parseInt(e.target.value) || 0))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-amber-300 outline-none focus:border-amber-500"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                            Token Order
                          </span>
                        </div>
                      </div>

                      {/* Quick Chips */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-slate-400 font-semibold mr-1">Pilihan Cepat:</span>
                        {[500, 1000, 2000, 5000, 10000].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setCustomTokenAmount(val)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                              customTokenAmount === val
                                ? 'bg-amber-600 text-white border-amber-500'
                                : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                            }`}
                          >
                            +{val.toLocaleString('id-ID')}
                          </button>
                        ))}
                      </div>

                      <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-slate-400">Estimasi Biaya (@ Rp 110/order):</span>
                        <span className="font-black text-amber-300">{formatRupiah(estimatedCustomPrice)}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Masa Aktif Token */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Infinity className="w-4 h-4 text-emerald-400" />
                      <div>
                        <span className="text-xs font-bold text-white block">Masa Aktif Tanpa Hangus</span>
                        <span className="text-[10px] text-slate-400">Saldo kuota berlaku selamanya tanpa kedaluwarsa</span>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={topUpNeverExpires}
                        onChange={(e) => setTopUpNeverExpires(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  {!topUpNeverExpires && (
                    <div className="mt-3 pt-3 border-t border-slate-800 grid grid-cols-3 gap-2">
                      {[30, 90, 365].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => setSelectedDurationDays(days)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                            selectedDurationDays === days
                              ? 'bg-indigo-600 text-white border-indigo-500'
                              : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          +{days} Hari
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Voucher Promo SaaS B2B Selector */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Kupon Promo SaaS B2B Platform:</span>
                    </label>
                    {activeSelectedPromo && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        {activeSelectedPromo.code} Terpasang
                      </span>
                    )}
                  </div>
                  <select
                    value={topUpPromoCode}
                    onChange={(e) => setTopUpPromoCode(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 font-semibold"
                  >
                    <option value="">-- Tanpa Kupon Promo --</option>
                    {promos.filter((p) => p.isActive).map((p) => (
                      <option key={p.code} value={p.code}>
                        🏷️ {p.code} — {p.name} ({p.type === 'DISCOUNT_PERCENT' ? `Diskon ${p.value}%` : p.type === 'DISCOUNT_FIXED' ? `Potongan ${formatRupiah(p.value)}` : `Bonus +${p.value.toLocaleString('id-ID')} Token`})
                      </option>
                    ))}
                  </select>

                  {activeSelectedPromo && (
                    <div className="p-2.5 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs flex items-center justify-between">
                      <span className="text-indigo-200 text-[11px]">
                        Benefit Promo: <strong>{activeSelectedPromo.name}</strong>
                      </span>
                      <span className="font-black text-emerald-400">
                        {activeSelectedPromo.type === 'BONUS_TOKENS' 
                          ? `+${bonusTokenVal.toLocaleString('id-ID')} Token Ekstra Gratis` 
                          : `- ${formatRupiah(promoDiscount)}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Metode Pembayaran & Catatan */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Metode Top-Up:
                    </label>
                    <select
                      value={topUpPaymentMethod}
                      onChange={(e) => setTopUpPaymentMethod(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 font-semibold"
                    >
                      <option value="BANK_TRANSFER">Transfer Bank Manual (BCA/Mandiri)</option>
                      <option value="QRIS_MIDTRANS">QRIS &amp; Virtual Account (Midtrans)</option>
                      <option value="ADMIN_BONUS">Bonus Onboarding / Kompensasi SuperAdmin</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">
                      Catatan / Referensi:
                    </label>
                    <input
                      type="text"
                      placeholder="Contoh: Transfer BCA Ref #7781..."
                      value={topUpNotes}
                      onChange={(e) => setTopUpNotes(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Live Projection Box */}
                <div className="p-3 bg-gradient-to-r from-indigo-950/70 to-slate-950 border border-indigo-900/60 rounded-xl text-xs flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-indigo-300 uppercase tracking-wider font-bold">Proyeksi Saldo Baru</span>
                    <p className="text-white font-black text-sm flex items-center gap-1.5">
                      <span>{currentQuota.remainingQuota.toLocaleString('id-ID')}</span>
                      <span className="text-amber-400">+{addedTokens.toLocaleString('id-ID')}</span>
                      <span className="text-slate-400">➔</span>
                      <span className="text-emerald-400 text-base">{projectedNewTotal.toLocaleString('id-ID')} Token</span>
                    </p>
                    {bonusTokenVal > 0 && (
                      <span className="text-[10px] text-emerald-300 font-bold block">
                        (Termasuk bonus promo +{bonusTokenVal.toLocaleString('id-ID')} token)
                      </span>
                    )}
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Bayar</span>
                    <span className="text-base font-black text-amber-300">
                      {finalPayable > 0 ? formatRupiah(finalPayable) : 'Gratis / Rp 0'}
                    </span>
                  </div>
                </div>
                </div>

                {/* Sticky Submit Action Footer */}
                <div className="pt-3 border-t border-slate-800 shrink-0">
                  <button
                    type="submit"
                    disabled={submittingSub}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-98 disabled:opacity-50 text-slate-950 font-black rounded-xl shadow-lg shadow-amber-500/30 transition-all text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {submittingSub ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Memproses Top-Up Kuota...</span>
                      </>
                    ) : (
                      <>
                        <Coins className="w-4 h-4 text-slate-950" />
                        <span>Konfirmasi &amp; Suntik Kuota (+{addedTokens.toLocaleString('id-ID')} Token)</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

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
          MODAL 4: PREVIEW FAKTUR DIGITAL SAAS (OFFICIAL TAX INVOICE PREVIEW)
      ========================================================================= */}
      {selectedInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative text-slate-200 my-8">
            <button
              type="button"
              onClick={() => setSelectedInvoiceModal(null)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Invoice Top Header */}
            <div className="border-b border-slate-800 pb-5 mb-5 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-white text-xs">
                    W
                  </div>
                  <span className="font-black text-base text-white tracking-tight">Well POS Platform</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Cloud POS &amp; Inventory Operating System</p>
                <p className="text-[10px] text-slate-500 font-mono font-semibold tracking-wider">
                  NITKU: 3313122505910002000000 &bull; Indonesia
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Official Tax Invoice</span>
                <span className="font-mono font-black text-sm text-indigo-400">{selectedInvoiceModal.invoiceNumber}</span>
                <div className="mt-1">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black border uppercase ${
                    selectedInvoiceModal.status === 'PAID'
                      ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                      : 'bg-amber-950 text-amber-300 border-amber-800'
                  }`}>
                    {selectedInvoiceModal.status === 'PAID' ? '✔ PAID / VERIFIED' : '⏳ PENDING PAYMENT'}
                  </span>
                </div>
              </div>
            </div>

            {/* Client & Date Info */}
            <div className="grid grid-cols-2 gap-4 bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-5 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Ditagihkan Kepada:</span>
                <p className="font-bold text-white text-sm">
                  {selectedInvoiceModal.tenant?.name || selectedInvoiceModal.tenant?.businessName || selectedInvoiceModal.tenantName || 'Tenant Klien'}
                </p>
                <p className="text-slate-400 mt-0.5">
                  Pemilik: {selectedInvoiceModal.tenant?.owner?.name || selectedInvoiceModal.ownerName || '-'}
                </p>
                <p className="text-slate-400">
                  {selectedInvoiceModal.tenant?.owner?.email || selectedInvoiceModal.ownerEmail || selectedInvoiceModal.tenantPhone || '-'}
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Detail Penerbitan:</span>
                <p className="text-slate-300">
                  Tanggal:{' '}
                  <strong className="text-white">
                    {new Date(selectedInvoiceModal.issuedAt || selectedInvoiceModal.createdAt).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </strong>
                </p>
                <p className="text-slate-400 mt-0.5">Metode: {selectedInvoiceModal.paymentMethod || 'Transfer Manual'}</p>
                {selectedInvoiceModal.paidAt && (
                  <p className="text-emerald-400 text-[11px] font-semibold mt-0.5">
                    Dibayar: {new Date(selectedInvoiceModal.paidAt).toLocaleDateString('id-ID')}
                  </p>
                )}
              </div>
            </div>

            {/* Line Item Table */}
            <div className="border border-slate-800 rounded-2xl overflow-hidden mb-5">
              <table className="w-full text-left border-collapse text-xs text-slate-300">
                <thead>
                  <tr className="bg-slate-950 text-[10px] text-slate-400 uppercase font-black tracking-wider border-b border-slate-800">
                    <th className="py-2.5 px-3">Deskripsi Layanan / Item</th>
                    <th className="py-2.5 px-3 text-center">Token</th>
                    <th className="py-2.5 px-3 text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  <tr>
                    <td className="py-3 px-3">
                      <span className="font-bold text-white block">{selectedInvoiceModal.notes || 'Biaya Berlangganan Well POS'}</span>
                      <span className="text-[10px] text-slate-500">Model Pay-As-You-Go &bull; Tanpa Batas Waktu Hangus</span>
                    </td>
                    <td className="py-3 px-3 text-center font-bold text-amber-400">
                      {selectedInvoiceModal.tokenAmount > 0 ? `+${Number(selectedInvoiceModal.tokenAmount).toLocaleString('id-ID')}` : '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-black text-white">
                      {formatRupiah(Number(selectedInvoiceModal.amount) + Number(selectedInvoiceModal.discountAmount || 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Summary Breakdown */}
            <div className="space-y-1.5 text-xs border-b border-slate-800 pb-4 mb-5">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal Layanan:</span>
                <span className="text-slate-200 font-semibold">
                  {formatRupiah(Number(selectedInvoiceModal.amount) + Number(selectedInvoiceModal.discountAmount || 0))}
                </span>
              </div>
              {selectedInvoiceModal.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Diskon Kupon Promo ({selectedInvoiceModal.promoCode || 'PROMO'}):</span>
                  <span className="font-bold">- {formatRupiah(Number(selectedInvoiceModal.discountAmount))}</span>
                </div>
              )}
              <div className="flex justify-between text-white font-black text-base pt-2 border-t border-slate-800">
                <span>Total Tagihan:</span>
                <span className="text-indigo-400">{formatRupiah(Number(selectedInvoiceModal.amount))}</span>
              </div>
            </div>

            {/* Digital Stamp & Footer Notes */}
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 mb-5 flex items-center justify-between text-[11px] text-slate-400">
              <div>
                <p className="font-bold text-white">Electronic Receipt &amp; Tax Verification</p>
                <p className="text-[10px] text-slate-500 mt-0.5">This document is electronically verified and issued by Well POS Platform HQ.</p>
              </div>
              <div className="text-right">
                <span className="text-emerald-400 font-black tracking-wider uppercase text-[10px]">
                  [DIGITALLY VERIFIED]
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak / Simpan PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedInvoiceModal(null)}
                className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: TAMBAH ANGGOTA TIM STAF PLATFORM (RBAC)
      ========================================================================= */}
      {isCreateStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative text-slate-200">
            <button
              type="button"
              onClick={() => setIsCreateStaffModalOpen(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mx-auto mb-3 shadow-md">
                <UserPlus className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">Tambah Staf Platform Baru</h3>
              <p className="text-xs text-slate-400 mt-1">
                Berikan kredensial akses masuk ke Control Tower internal Well POS HQ.
              </p>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Nama Lengkap Staf:</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Rian Anggara"
                  value={newStaffForm.name}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Alamat Email Kerja:</label>
                <input
                  type="email"
                  required
                  placeholder="Contoh: rian@wellpos.id"
                  value={newStaffForm.email}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Kata Sandi Awal:</label>
                <input
                  type="password"
                  required
                  placeholder="Minimal 6 karakter..."
                  value={newStaffForm.password}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Peran &amp; Wewenang (RBAC):</label>
                <select
                  value={newStaffForm.role}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, role: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 font-semibold"
                >
                  <option value="SUPPORT">SUPPORT — Layanan Bantuan Klien &amp; Reset Sandi</option>
                  <option value="BILLING">BILLING — Verifikasi Pembayaran &amp; Manajemen Kupon</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN — Akses Administrator Penuh</option>
                </select>
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateStaffModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingStaff}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submittingStaff ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
                  <span>{submittingStaff ? 'Menyimpan...' : 'Simpan Staf'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 6: BUAT PROMO SAAS PLATFORM BARU (B2B ENGINE)
      ========================================================================= */}
      {isCreatePromoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative text-slate-200 my-8">
            <button
              type="button"
              onClick={() => setIsCreatePromoModalOpen(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto mb-3 shadow-md">
                <Tag className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white">Buat Kupon Promo SaaS B2B Baru</h3>
              <p className="text-xs text-slate-400 mt-1">
                Kupon diskon setup fee onboarding atau bonus kuota token untuk merchant.
              </p>
            </div>

            <form onSubmit={handleCreatePromo} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Kode Kupon:</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: HEMAT50K"
                    value={newPromoForm.code}
                    onChange={(e) => setNewPromoForm({ ...newPromoForm, code: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-indigo-300 placeholder:text-slate-600 outline-none focus:border-indigo-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Nama Promo:</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Promo Grand Opening"
                    value={newPromoForm.name}
                    onChange={(e) => setNewPromoForm({ ...newPromoForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Tipe Benefit Kupon:</label>
                <select
                  value={newPromoForm.type}
                  onChange={(e) => setNewPromoForm({ ...newPromoForm, type: e.target.value as any })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 font-semibold"
                >
                  <option value="DISCOUNT_PERCENT">DISCOUNT_PERCENT — Diskon Persentase (%)</option>
                  <option value="DISCOUNT_FIXED">DISCOUNT_FIXED — Potongan Nominal Rupiah (Rp)</option>
                  <option value="BONUS_TOKENS">BONUS_TOKENS — Ekstra Bonus Token Order Gratis</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    {newPromoForm.type === 'DISCOUNT_PERCENT'
                      ? 'Nilai Diskon (%):'
                      : newPromoForm.type === 'DISCOUNT_FIXED'
                      ? 'Nominal Potongan (Rp):'
                      : 'Jumlah Bonus Token:'}
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newPromoForm.value}
                    onChange={(e) => setNewPromoForm({ ...newPromoForm, value: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-bold text-emerald-400 outline-none focus:border-indigo-500"
                  />
                </div>

                {newPromoForm.type === 'DISCOUNT_PERCENT' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Maksimal Diskon (Rp):</label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      placeholder="0 = Tanpa batas"
                      value={newPromoForm.maxDiscount}
                      onChange={(e) => setNewPromoForm({ ...newPromoForm, maxDiscount: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Min. Belanja (Rp):</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={newPromoForm.minSpend}
                    onChange={(e) => setNewPromoForm({ ...newPromoForm, minSpend: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Batas Kuota Pemakaian:</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Contoh: 100 kali"
                    value={newPromoForm.usageLimit}
                    onChange={(e) => setNewPromoForm({ ...newPromoForm, usageLimit: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Berlaku Sampai Tanggal:</label>
                <input
                  type="date"
                  value={newPromoForm.validUntil}
                  onChange={(e) => setNewPromoForm({ ...newPromoForm, validUntil: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreatePromoModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingPromo}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {submittingPromo ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Tag className="w-3.5 h-3.5" />}
                  <span>{submittingPromo ? 'Menerbitkan...' : 'Terbitkan Promo'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: PENGATURAN QRIS STATIS PLATFORM & REKENING HQ (SUPERADMIN)
      ========================================================================= */}
      {isPaymentConfigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 shadow-2xl relative text-slate-200">
            <button
              type="button"
              onClick={() => setIsPaymentConfigModalOpen(false)}
              className="absolute top-5 right-5 p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-white">Pengaturan QRIS &amp; Rekening Platform HQ</h3>
                <p className="text-xs text-slate-400">
                  Data ini ditampilkan langsung ke seluruh Owner saat melakukan Top-Up Token di portal Backoffice.
                </p>
              </div>
            </div>

            {paymentConfigLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                <span className="text-xs">Memuat pengaturan...</span>
              </div>
            ) : (
              <form onSubmit={handleSavePaymentConfig} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Nama Merchant QRIS:</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: WELL POS PLATFORM HQ"
                      value={paymentConfig.merchantName}
                      onChange={(e) => setPaymentConfig({ ...paymentConfig, merchantName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">NMID (National Merchant ID):</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: ID1020030040050"
                      value={paymentConfig.nmid}
                      onChange={(e) => setPaymentConfig({ ...paymentConfig, nmid: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Nama Bank:</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: BCA"
                      value={paymentConfig.bankName}
                      onChange={(e) => setPaymentConfig({ ...paymentConfig, bankName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Nomor Rekening:</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 8830129381"
                      value={paymentConfig.accountNumber}
                      onChange={(e) => setPaymentConfig({ ...paymentConfig, accountNumber: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Atas Nama:</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: PT WELL DIGITAL ASIA"
                      value={paymentConfig.accountHolder}
                      onChange={(e) => setPaymentConfig({ ...paymentConfig, accountHolder: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">URL Gambar QRIS Statis:</label>
                  <input
                    type="url"
                    required
                    placeholder="https://..."
                    value={paymentConfig.imageUrl}
                    onChange={(e) => setPaymentConfig({ ...paymentConfig, imageUrl: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    URL gambar barcode QRIS statis standar QRIS/BI yang dapat dipindai oleh semua aplikasi m-banking dan e-wallet.
                  </span>
                </div>

                {/* Live Preview QR */}
                {paymentConfig.imageUrl && (
                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl flex items-center gap-4">
                    <div className="bg-white p-2 rounded-xl shadow-xs shrink-0">
                      <img
                        src={paymentConfig.imageUrl}
                        alt="QRIS Preview"
                        className="w-16 h-16 object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="text-xs">
                      <p className="font-bold text-white">{paymentConfig.merchantName || 'Pratinjau Merchant'}</p>
                      <p className="text-[10px] text-slate-400 font-mono">NMID: {paymentConfig.nmid || '-'}</p>
                      <p className="text-[10px] text-emerald-400 mt-0.5">✔ Tampil langsung di modal Top-Up Owner</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Catatan / Panduan untuk Merchant:</label>
                  <textarea
                    rows={2}
                    value={paymentConfig.notes}
                    onChange={(e) => setPaymentConfig({ ...paymentConfig, notes: e.target.value })}
                    placeholder="Petunjuk transfer / scan untuk merchant..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPaymentConfigModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={paymentConfigSubmitting}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {paymentConfigSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    <span>{paymentConfigSubmitting ? 'Menyimpan...' : 'Simpan Konfigurasi QRIS'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: CUSTOM CONFIRMATION DIALOG (NO BROWSER POPUPS)
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
