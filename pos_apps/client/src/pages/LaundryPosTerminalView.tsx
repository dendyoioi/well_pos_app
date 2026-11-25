import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Shirt,
  Search,
  Scale,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Printer,
  Sparkles,
  Layers,
  User,
  AlertCircle,
  X,
  CreditCard,
  QrCode,
  ArrowRight,
  Archive,
  Truck,
  RotateCcw,
  FilePlus2,
  Tag,
  Phone,
  MapPin,
  Lock,
  UserPlus,
  Check,
  Wallet,
  Loader2,
  WifiOff,
  ShoppingCart,
  ChevronRight,
  ChevronDown,
  Play,
  Square,
  FileText,
  ArrowUpRight,
  UserCheck,
  Ticket,
  Star,
  CloudUpload,
  RefreshCw,
  Sliders,
} from 'lucide-react';
import type { Outlet } from '../types/outlet';
import type {
  LaundryService,
  LaundryQueueOrder,
  CustomerLaundryWallet,
  LaundryDeliveryConfig,
  LaundryDeliveryType,
  LaundryPerfume,
} from '../types/laundry';
import type { Shift } from '../types/shift';
import type { Promotion } from '../types/promotion';
import { api, customerApi, attendanceApi } from '../services/api';
import { WhatsAppInput, CurrencyInput } from '../components/ui';
import { LaundryReceiptModal } from '../components/laundry/LaundryReceiptModal';
import { CustomerPreferenceBadges } from '../components/laundry/CustomerPreferenceBadges';
import { CustomerPreferenceModal } from '../components/laundry/CustomerPreferenceModal';
import { StartShiftModal } from '../components/StartShiftModal';
import { CloseShiftModal } from '../components/CloseShiftModal';
import { XReportModal } from '../components/XReportModal';
import { CashExpenseModal } from '../components/CashExpenseModal';
import { VoucherSelectionModal } from '../components/pos/VoucherSelectionModal';
import { StaffAttendanceModal } from '../components/pos/StaffAttendanceModal';
import {
  generateIdempotencyKey,
  saveOfflineOrder,
  getPendingOfflineOrders,
  getOfflineQueueCount,
  markOfflineOrderSyncing,
  markOfflineOrderSuccess,
  markOfflineOrderFailed,
  clearSyncedOfflineOrders,
} from '../utils/offlineQueue';

interface LaundryPosTerminalViewProps {
  activeOutlet: Outlet | null;
  currentUser: any;
  onNavigateTab: (tab: string) => void;
  onLogout: () => void;
}

interface CartItem {
  id: string; // temporary cart id
  serviceId: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  quantity: number; // kuantitas ditagih (billed quantity)
  actualQuantity: number; // bobot/kuantitas fisik asli
  isUnderMinimum: boolean;
  minOrderQty: number;
  totalPieces: number;
  perfumeVariant: string;
  estimatedReadyHours: number;
  notes: string;
  subtotal: number;
  addons?: Array<{
    id: string;
    name: string;
    price: number;
    unit: string;
    total: number;
  }>;
}

const QUICK_NOTES = [
  'Pisahkan Pakaian Putih',
  'Ada Noda di Kerah',
  'Bahan Sutra / Sensitif',
  'Kancing Lepas / Kerusakan Bawaan',
  'Kelunturan',
];

export const LaundryPosTerminalView: React.FC<LaundryPosTerminalViewProps> = ({
  activeOutlet,
  currentUser,
  onNavigateTab,
  onLogout,
}) => {
  const [services, setServices] = useState<LaundryService[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  // Offline-First PWA Sync State
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueueCount, setOfflineQueueCount] = useState<{ pending: number; total: number }>({ pending: 0, total: 0 });
  const [isSyncingOffline, setIsSyncingOffline] = useState<boolean>(false);

  // Pelanggan & CRM
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [prefModalOpen, setPrefModalOpen] = useState(false);

  // Layanan yang tertunda (diklik saat kasir belum input nama pelanggan)
  const [pendingService, setPendingService] = useState<LaundryService | null>(null);

  // Modal Cari Pelanggan Terdaftar (Member Lookup) & Quick Add Customer
  const [customerSearchModalOpen, setCustomerSearchModalOpen] = useState(false);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [quickAddModalOpen, setQuickAddModalOpen] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');
  const [newCustLandmark, setNewCustLandmark] = useState('');
  const [savingNewCustomer, setSavingNewCustomer] = useState(false);
  const [activateDepositOnRegister, setActivateDepositOnRegister] = useState(false);
  const [regTopupType, setRegTopupType] = useState<'BALANCE' | 'QUOTA_KG'>('BALANCE');
  const [, setRegPackageId] = useState<string>('');
  const [regAmount, setRegAmount] = useState<number>(100000);
  const [regBonusAmount, setRegBonusAmount] = useState<number>(0);
  const [regKg, setRegKg] = useState<number>(10);
  const [regQuotaBonusKg, setRegQuotaBonusKg] = useState<number>(0);
  const [regPricePaid, setRegPricePaid] = useState<number>(100000);
  const [regPaymentMethod, setRegPaymentMethod] = useState<'CASH' | 'QRIS' | 'TRANSFER'>('CASH');
  const [regValidityDays, setRegValidityDays] = useState<'30' | '60' | '90' | 'UNLIMITED'>('30');

  // Customer-First Guardrail: Pelanggan WAJIB diisi sebelum memilih layanan
  const isCustomerFilled = Boolean(customerName.trim().length >= 2);

  // Keranjang
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  // Konfigurasi Item saat dipilih dari katalog
  const [selectedService, setSelectedService] = useState<LaundryService | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [itemWeightKg, setItemWeightKg] = useState('3.0');
  const [itemPieces, setItemPieces] = useState('10');
  const [itemPerfume, setItemPerfume] = useState('Lavender');
  const [perfumes, setPerfumes] = useState<LaundryPerfume[]>([]);
  const [itemNotes, setItemNotes] = useState('');
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  // Pembayaran
  const [paymentChoice, setPaymentChoice] = useState<'PAID' | 'PARTIAL' | 'UNPAID'>('PAID');
  const [depositAmount, setDepositAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'TRANSFER' | 'CUSTOMER_DEPOSIT' | 'LAUNDRY_QUOTA'>('CASH');
  const [cashReceived, setCashReceived] = useState<string>('');

  // Dompet Laundry Pelanggan (Deposit & Kuota)
  const [customerWallet, setCustomerWallet] = useState<CustomerLaundryWallet | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [topupType, setTopupType] = useState<'BALANCE' | 'QUOTA_KG'>('BALANCE');
  const [topupAmount, setTopupAmount] = useState('100000');
  const [topupKg, setTopupKg] = useState('10');
  const [topupPricePaid, setTopupPricePaid] = useState('70000');
  const [topupPaymentMethod, setTopupPaymentMethod] = useState<'CASH' | 'QRIS' | 'TRANSFER'>('CASH');
  const [topupValidityDays, setTopupValidityDays] = useState<'30' | '60' | '90' | 'UNLIMITED'>('30');
  const [topupBonusAmount, setTopupBonusAmount] = useState('0');
  const [topupQuotaBonusKg, setTopupQuotaBonusKg] = useState('0');
  const [depositConfig, setDepositConfig] = useState<{ packages: any[]; expiryPolicy: 'ACCUMULATE' | 'EXPIRE' }>({
    packages: [],
    expiryPolicy: 'ACCUMULATE',
  });
  const [processingTopup, setProcessingTopup] = useState(false);

  // Diskon / Kupon Promo
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('FIXED');
  const [discountValue, setDiscountValue] = useState('0');

  // Voucher Terkelola (Pilar 2)
  const [appliedPromotion, setAppliedPromotion] = useState<Promotion | null>(null);
  const [voucherModalOpen, setVoucherModalOpen] = useState(false);

  // Program Loyalitas & Poin Member (Pilar 3)
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);
  const outletLoyaltyConfig = (activeOutlet as any)?.loyaltyConfig as any | undefined;
  const isLoyaltyActive = Boolean(outletLoyaltyConfig?.isActive);
  const pointValueIdr = outletLoyaltyConfig?.pointValueIdr ? Number(outletLoyaltyConfig.pointValueIdr) : 100;
  const minPointsToRedeem = outletLoyaltyConfig?.minPointsToRedeem ? Number(outletLoyaltyConfig.minPointsToRedeem) : 10;

  // Konfigurasi QRIS Statis Toko (Pilar 1 - Gelombang 2)
  const qrisConfig = activeOutlet?.paymentConfig?.qris;
  const isQrisActive = qrisConfig ? qrisConfig.isActive !== false : true;
  const qrisImageUrl = qrisConfig?.imageUrl || null;

  // Fallback otomatis jika metode QRIS dipilih padahal QRIS dinonaktifkan di pengaturan
  useEffect(() => {
    if (!isQrisActive && paymentMethod === 'QRIS') {
      setPaymentMethod('CASH');
    }
    if (!isQrisActive && topupPaymentMethod === 'QRIS') {
      setTopupPaymentMethod('CASH');
    }
  }, [isQrisActive, paymentMethod, topupPaymentMethod]);

  // Siklus Shift Kasir (Pilar 1)
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [startShiftModalOpen, setStartShiftModalOpen] = useState(false);
  const [closeShiftModalOpen, setCloseShiftModalOpen] = useState(false);
  const [xReportModalOpen, setXReportModalOpen] = useState(false);
  const [cashExpenseModalOpen, setCashExpenseModalOpen] = useState(false);
  const canCashOut = Boolean(
    currentUser &&
      (['OWNER', 'ADMIN', 'SUPERVISOR'].includes(currentUser.role) || currentUser.canCashOut === true)
  );

  // Absensi Staf Kasir (Pilar 4)
  const [staffAttendanceModalOpen, setStaffAttendanceModalOpen] = useState(false);

  // Transaksi Processing & Modal Struk
  const [processingOrder, setProcessingOrder] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<LaundryQueueOrder | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [mobileCartSheetOpen, setMobileCartSheetOpen] = useState(false);

  // Delivery & Antar-Jemput State
  const [deliveryConfig, setDeliveryConfig] = useState<LaundryDeliveryConfig | null>(null);
  const [deliveryType, setDeliveryType] = useState<LaundryDeliveryType>('NONE');
  const [deliveryZoneId, setDeliveryZoneId] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');

  // Ambil daftar layanan dari API
  const fetchServices = async () => {
    try {
      setLoadingServices(true);
      const res = await api.getLaundryServices(activeOutlet?.id);
      if (res.status === 'success' && Array.isArray(res.data)) {
        const availableServices = res.data.filter((s: any) => s.isAvailableAtOutlet !== false);
        setServices(availableServices);
      }
    } catch {
      // Abaikan jika offline
    } finally {
      setLoadingServices(false);
    }
  };

  // Ambil daftar pelanggan untuk pencarian cepat CRM
  const fetchCustomers = async () => {
    try {
      const res = await customerApi.getCustomers({ limit: 100 });
      if (res.status === 'success' && Array.isArray(res.data)) {
        setCustomersList(res.data);
        if (selectedCustomerId) {
          const fresh = res.data.find((c: any) => c.id === selectedCustomerId);
          if (fresh) setSelectedCustomer(fresh);
        }
      }
    } catch {
      // Abaikan jika CRM error
    }
  };

  // Muat status shift kasir berjalan
  const loadCurrentShift = async () => {
    try {
      const res = await api.getCurrentShift();
      if (res.status === 'success' && res.data) {
        setCurrentShift(res.data);
      } else {
        setCurrentShift(null);
      }
    } catch {
      setCurrentShift(null);
    }
  };

  // Buka dialog tutup shift kasir dengan refresh data shift terbaru
  const handleOpenCloseShift = () => {
    loadCurrentShift();
    setCloseShiftModalOpen(true);
  };

  // Helper pembaruan jumlah antrean offline kasir laundry
  const refreshOfflineQueueCount = useCallback(async () => {
    try {
      const stats = await getOfflineQueueCount(activeOutlet?.id, 'LAUNDRY');
      setOfflineQueueCount(stats);
    } catch {
      // Ignored
    }
  }, [activeOutlet?.id]);

  // Handler sinkronisasi transaksi offline kasir laundry
  const syncOfflineLaundryOrders = useCallback(async () => {
    if (isSyncingOffline || !navigator.onLine) return;
    setIsSyncingOffline(true);
    try {
      const pendingOrders = await getPendingOfflineOrders(activeOutlet?.id, 'LAUNDRY');
      if (pendingOrders.length === 0) {
        await refreshOfflineQueueCount();
        setIsSyncingOffline(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const offlineOrder of pendingOrders) {
        try {
          await markOfflineOrderSyncing(offlineOrder.offlineId);
          const idempotencyKey = offlineOrder.clientRequestId || offlineOrder.offlineId;
          const res = await api.createLaundryOrder(offlineOrder.payload, { idempotencyKey });
          if (res.status === 'success' && res.data) {
            await markOfflineOrderSuccess(offlineOrder.offlineId, res.data);
            successCount++;
          } else {
            await markOfflineOrderFailed(offlineOrder.offlineId, res.message || 'Gagal sinkron');
            failCount++;
          }
        } catch (syncErr: any) {
          await markOfflineOrderFailed(offlineOrder.offlineId, syncErr.message || 'Network error');
          failCount++;
        }
      }

      await clearSyncedOfflineOrders();
      await refreshOfflineQueueCount();

      if (successCount > 0) {
        setFeedbackToast({
          message: `${successCount} transaksi laundry offline berhasil disinkronkan ke server!`,
          type: 'success',
        });
        setTimeout(() => setFeedbackToast(null), 4000);
        fetchCustomers();
        loadCurrentShift();
      }
      if (failCount > 0) {
        setFeedbackToast({
          message: `${failCount} transaksi laundry offline gagal disinkronkan. Akan dicoba lagi otomatis.`,
          type: 'error',
        });
        setTimeout(() => setFeedbackToast(null), 5000);
      }
    } catch (err: any) {
      console.error('Error saat menyinkronkan antrean laundry offline:', err);
    } finally {
      setIsSyncingOffline(false);
    }
  }, [isSyncingOffline, activeOutlet?.id, refreshOfflineQueueCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refreshOfflineQueueCount();
      syncOfflineLaundryOrders();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    refreshOfflineQueueCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshOfflineQueueCount, syncOfflineLaundryOrders]);

  useEffect(() => {
    fetchServices();
    fetchCustomers();
    loadCurrentShift();
    api.getLaundryPerfumes()
      .then((res) => {
        if (res.status === 'success' && Array.isArray(res.data)) {
          setPerfumes(res.data.filter((p: LaundryPerfume) => p.isActive));
        }
      })
      .catch(() => {});
    if (activeOutlet?.id) {
      fetchServices();
      try {
        const clientTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (clientTz && clientTz !== activeOutlet.timezone) {
          attendanceApi
            .autoSyncTimezone({
              outletId: activeOutlet.id,
              clientTimezone: clientTz,
            })
            .catch(() => {});
        }
      } catch {}
      api
        .getLaundryDepositConfig(activeOutlet.id)
        .then((res) => {
          if (res.status === 'success' && res.data?.config) {
            setDepositConfig(res.data.config);
          }
        })
        .catch(() => {});
      api
        .getLaundryDeliveryConfig(activeOutlet.id)
        .then((res) => {
          if (res.status === 'success' && res.data) {
            setDeliveryConfig(res.data);
            if (res.data.zones && res.data.zones.length > 0) {
              setDeliveryZoneId(res.data.zones[0].id);
            }
          }
        })
        .catch(() => {});
    }
  }, [activeOutlet?.id]);

  const handleSelectCustomer = (cust: any) => {
    setCustomerName(cust.name || '');
    setCustomerPhone(cust.phone ? cust.phone.replace(/^\+?62/, '') : '');
    setSelectedCustomerId(cust.id);
    setSelectedCustomer(cust);
    setPointsToRedeem(0);
    if (cust.address && !deliveryAddress) {
      setDeliveryAddress(cust.address);
    }
    setCustomerSearchModalOpen(false);
    setQuickAddModalOpen(false);
    setFeedbackToast({
      message: `✅ Pelanggan "${cust.name}" terpilih.`,
      type: 'success',
    });
    if (pendingService) {
      openServiceModal(pendingService);
      setPendingService(null);
    }
  };

  const handleSelectWalkIn = (name: string) => {
    setCustomerName(name.trim());
    setCustomerPhone('');
    setSelectedCustomerId(null);
    setSelectedCustomer(null);
    setPointsToRedeem(0);
    setAppliedPromotion(null);
    setCustomerSearchModalOpen(false);
    setFeedbackToast({
      message: `✅ Pelanggan "${name.trim()}" terpilih.`,
      type: 'success',
    });
    if (pendingService) {
      openServiceModal(pendingService);
      setPendingService(null);
    }
  };

  const handleResetCustomer = () => {
    setCustomerName('');
    setCustomerPhone('');
    setSelectedCustomerId(null);
    setSelectedCustomer(null);
    setCustomerWallet(null);
    setPointsToRedeem(0);
    setAppliedPromotion(null);
    setPendingService(null);
    if (paymentMethod === 'CUSTOMER_DEPOSIT' || paymentMethod === 'LAUNDRY_QUOTA') {
      setPaymentMethod('CASH');
    }
  };

  // Muat Saldo Deposit & Kuota Kiloan jika pelanggan terpilih
  useEffect(() => {
    if (selectedCustomerId) {
      setLoadingWallet(true);
      api.getCustomerLaundryWallet(selectedCustomerId)
        .then((res) => {
          if (res.status === 'success' && res.data) {
            setCustomerWallet(res.data);
          } else {
            setCustomerWallet(null);
          }
        })
        .catch(() => setCustomerWallet(null))
        .finally(() => setLoadingWallet(false));
    } else {
      setCustomerWallet(null);
    }
  }, [selectedCustomerId]);

  // Handler Pendaftaran Pelanggan Baru Cepat
  const handleQuickCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim()) {
      alert('Nama pelanggan wajib diisi');
      return;
    }
    if (!newCustPhone.trim()) {
      alert('Nomor WhatsApp pelanggan wajib diisi untuk kirim e-receipt & notifikasi cucian');
      return;
    }

    setSavingNewCustomer(true);
    try {
      const cleanPhone = `+62${newCustPhone.replace(/^0+/, '')}`;
      const res = await customerApi.createCustomer({
        name: newCustName.trim(),
        phone: cleanPhone,
        address: newCustAddress.trim() || undefined,
        notes: newCustLandmark.trim() || undefined,
      });

      if (res.status === 'success' && res.data) {
        const created = res.data;
        setCustomersList((prev) => [created, ...prev]);
        handleSelectCustomer(created);

        let depositSuccessMsg = '';
        if (activateDepositOnRegister && activeOutlet) {
          try {
            await api.topupCustomerLaundryWallet(created.id, {
              type: regTopupType,
              amount: regTopupType === 'BALANCE' ? Number(regAmount) : undefined,
              bonusAmount: regTopupType === 'BALANCE' && Number(regBonusAmount) > 0 ? Number(regBonusAmount) : undefined,
              kg: regTopupType === 'QUOTA_KG' ? Number(regKg) : undefined,
              quotaBonusKg: regTopupType === 'QUOTA_KG' && Number(regQuotaBonusKg) > 0 ? Number(regQuotaBonusKg) : undefined,
              pricePaid: Number(regPricePaid),
              paymentMethod: regPaymentMethod,
              outletId: activeOutlet.id,
              validityDays: regValidityDays !== 'UNLIMITED' ? Number(regValidityDays) : undefined,
              expiryPolicy: depositConfig.expiryPolicy,
              notes: `Aktivasi Paket saat Pendaftaran Pelanggan Baru (${activeOutlet.name})`,
            });
            const wRes = await api.getCustomerLaundryWallet(created.id);
            if (wRes.status === 'success' && wRes.data) {
              setCustomerWallet(wRes.data);
            }
            loadCurrentShift();
            depositSuccessMsg = ` & paket ${regTopupType === 'BALANCE' ? 'saldo deposit' : 'kuota'} berhasil diaktifkan!`;
          } catch (tErr: any) {
            console.error('Failed to activate deposit on register:', tErr);
          }
        }

        setQuickAddModalOpen(false);
        setNewCustName('');
        setNewCustPhone('');
        setNewCustAddress('');
        setNewCustLandmark('');
        setActivateDepositOnRegister(false);
        setFeedbackToast({
          message: `🎉 Pelanggan baru "${created.name}" berhasil didaftarkan${depositSuccessMsg}!`,
          type: 'success',
        });
      } else {
        alert(res.message || 'Gagal mendaftarkan pelanggan baru');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan saat mendaftarkan pelanggan');
    } finally {
      setSavingNewCustomer(false);
    }
  };

  // Handler Proses Top-up Saldo Deposit atau Kuota Kiloan
  // Load deposit packages saat modal dibuka
  useEffect(() => {
    if (topupModalOpen && activeOutlet) {
      api.getLaundryDepositConfig(activeOutlet.id).then((res) => {
        if (res.status === 'success' && res.data?.config) {
          setDepositConfig(res.data.config);
        }
      }).catch(() => {});
    }
  }, [topupModalOpen, activeOutlet?.id]);

  const handleProcessTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift) {
      alert('Buka shift kasir terlebih dahulu untuk mencatat transaksi kasir / top-up!');
      setStartShiftModalOpen(true);
      return;
    }
    if (!selectedCustomerId || !activeOutlet) {
      alert('Pelanggan dan outlet aktif wajib tersedia');
      return;
    }
    setProcessingTopup(true);
    try {
      const res = await api.topupCustomerLaundryWallet(selectedCustomerId, {
        type: topupType,
        amount: topupType === 'BALANCE' ? Number(topupAmount) : undefined,
        bonusAmount: topupType === 'BALANCE' && Number(topupBonusAmount) > 0 ? Number(topupBonusAmount) : undefined,
        kg: topupType === 'QUOTA_KG' ? Number(topupKg) : undefined,
        quotaBonusKg: topupType === 'QUOTA_KG' && Number(topupQuotaBonusKg) > 0 ? Number(topupQuotaBonusKg) : undefined,
        pricePaid: topupType === 'QUOTA_KG' ? Number(topupPricePaid) : Number(topupPricePaid || topupAmount),
        paymentMethod: topupPaymentMethod,
        outletId: activeOutlet.id,
        validityDays: topupValidityDays !== 'UNLIMITED' ? Number(topupValidityDays) : undefined,
        expiryPolicy: depositConfig.expiryPolicy,
        notes: `Top-up kasir ${activeOutlet.name}`,
      });

      if (res.status === 'success') {
        // Refresh wallet & update cash drawer position
        const walletRes = await api.getCustomerLaundryWallet(selectedCustomerId);
        if (walletRes.status === 'success' && walletRes.data) {
          setCustomerWallet(walletRes.data);
        }
        loadCurrentShift();
        setTopupModalOpen(false);
        setFeedbackToast({
          message: res.message || '🎉 Top-up berhasil dicatat!',
          type: 'success',
        });
        setTimeout(() => setFeedbackToast(null), 3500);
      } else {
        alert(res.message || 'Gagal memproses top-up');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi gangguan saat memproses top-up');
    } finally {
      setProcessingTopup(false);
    }
  };

  // Layanan Tambahan (Add-ons / Treatment) yang aktif
  const availableAddons = useMemo(() => {
    return services.filter((s) => s.category?.toUpperCase() === 'ADDON' && s.isActive);
  }, [services]);

  // Kategori Dinamis diekstrak otomatis dari katalog layanan aktif (exclude ADDON agar tidak clutter tab utama)
  const dynamicCategories = useMemo(() => {
    const raw = services
      .filter((s) => s.category?.toUpperCase() !== 'ADDON')
      .map((s) => s.category?.toUpperCase())
      .filter(Boolean);
    const unique = Array.from(new Set(raw));
    return ['ALL', ...unique];
  }, [services]);

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'ALL':
        return 'Semua Layanan';
      case 'KILOAN':
        return '🧺 Cuci Kiloan';
      case 'BEDDING':
        return '🛏️ Bedding & Selimut';
      case 'PAKAIAN_SATUAN':
        return '👔 Pakaian Satuan';
      case 'SATUAN':
        return '👔 Satuan';
      case 'DRY_CLEAN':
        return '✨ Dry Clean';
      case 'EXPRESS':
        return '⚡ Express';
      case 'SEPATU_TAS':
        return '👟 Sepatu & Tas';
      case 'BONEKA_BABY':
        return '🍼 Boneka & Baby Gear';
      case 'TREATMENT':
        return '✨ Treatment';
      case 'KARPET_GORDEN':
        return '🏠 Karpet & Gorden';
      case 'STROLLER':
        return '🍼 Stroller & Baby';
      default:
        return `🏷️ ${cat.replace(/_/g, ' ')}`;
    }
  };

  // Filter Layanan Utama (Add-on dikecualikan dari grid katalog utama karena dipilih di dalam modal cucian)
  const filteredServices = useMemo(() => {
    return services.filter((s) => {
      if (!s.isActive) return false;
      if (s.category?.toUpperCase() === 'ADDON') return false;
      const matchCat =
        activeCategory === 'ALL' ||
        s.category.toUpperCase() === activeCategory.toUpperCase();
      const matchQuery =
        !searchQuery.trim() ||
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [services, activeCategory, searchQuery]);

  const openServiceModal = (srv: LaundryService) => {
    if (!currentShift) {
      setFeedbackToast({
        message: '⚠️ Buka shift kasir terlebih dahulu untuk mulai melayani transaksi cucian!',
        type: 'error',
      });
      setStartShiftModalOpen(true);
      return;
    }
    setSelectedService(srv);
    const unitUpper = (srv.unit || '').toUpperCase();
    const isWeightOrArea = ['KG', 'M2', 'M²', 'METER'].includes(unitUpper);
    const rawMin = Number(srv.minOrderQty);
    const hasMinRule = rawMin > 1;
    setItemWeightKg(hasMinRule ? String(rawMin) : isWeightOrArea ? '3.0' : '1.0');
    setItemPieces(unitUpper === 'KG' ? '10' : '1');
    setItemPerfume(perfumes.length > 0 ? perfumes[0].name : 'Standard');
    setItemNotes('');
    setSelectedAddonIds([]);
    setModalOpen(true);
  };

  // Klik kartu layanan: jika pelanggan belum diisi, buka modal input pelanggan terlebih dahulu
  const handleSelectService = (srv: LaundryService) => {
    if (!currentShift) {
      setFeedbackToast({
        message: '⚠️ Buka shift kasir terlebih dahulu untuk mulai melayani transaksi cucian!',
        type: 'error',
      });
      setStartShiftModalOpen(true);
      return;
    }
    if (!isCustomerFilled) {
      setPendingService(srv);
      setCustomerSearchModalOpen(true);
      return;
    }
    openServiceModal(srv);
  };

  // Kalkulasi harga item saat ini di modal dengan penegakan Minimum Order Quantity (minOrderQty)
  const modalCalculatedPrice = useMemo(() => {
    if (!selectedService) {
      return {
        unitPrice: 0,
        subtotal: 0,
        hours: 48,
        actualQty: 0,
        billedQty: 0,
        isUnderMinimum: false,
        minQty: 1,
      };
    }

    const effectiveUnitPrice = Math.round(Number(selectedService.price));
    const hours = selectedService.durationHours || 48;
    const unitUpper = (selectedService.unit || '').toUpperCase();
    const isWeightOrArea = ['KG', 'M2', 'M²', 'METER'].includes(unitUpper);
    const actualQty = isWeightOrArea ? parseFloat(itemWeightKg) || 0 : parseInt(itemPieces, 10) || 1;
    const rawMin = Number(selectedService.minOrderQty);
    const hasMinRule = rawMin > 1;
    const minQty = hasMinRule ? rawMin : 0;

    const isUnderMinimum = hasMinRule && actualQty > 0 && actualQty < minQty;
    const billedQty = isUnderMinimum ? minQty : actualQty;
    const subtotal = Math.round(effectiveUnitPrice * billedQty);

    return {
      unitPrice: effectiveUnitPrice,
      subtotal,
      hours,
      actualQty,
      billedQty,
      isUnderMinimum,
      minQty,
    };
  }, [selectedService, itemWeightKg, itemPieces]);

  // Kalkulasi Biaya Add-on & Treatment khusus yang dipilih
  const addonsCalculation = useMemo(() => {
    let total = 0;
    const items: Array<{ id: string; name: string; price: number; unit: string; total: number }> = [];
    selectedAddonIds.forEach((id) => {
      const addon = availableAddons.find((a) => a.id === id);
      if (addon) {
        const isPerKg = ['PER_KG', 'PER_UNIT', 'KG'].includes((addon.unit || '').toUpperCase());
        const billedQty = modalCalculatedPrice.billedQty;
        const lineAddonPrice = isPerKg ? Math.round(Number(addon.price) * billedQty) : Number(addon.price);
        total += lineAddonPrice;
        items.push({
          id: addon.id,
          name: addon.name,
          price: Number(addon.price),
          unit: addon.unit,
          total: lineAddonPrice,
        });
      }
    });

    const matchedPerfume = perfumes.find((p) => p.name.toLowerCase() === itemPerfume.toLowerCase());
    if (matchedPerfume && Number(matchedPerfume.extraPrice) > 0) {
      const extra = Number(matchedPerfume.extraPrice);
      total += extra;
      items.push({
        id: `perfume-${matchedPerfume.id}`,
        name: `Parfum Premium (${matchedPerfume.name})`,
        price: extra,
        unit: 'PER_ORDER',
        total: extra,
      });
    }

    return { total, items };
  }, [selectedAddonIds, availableAddons, modalCalculatedPrice.billedQty, itemPerfume, perfumes]);

  // Tambahkan item dari modal ke keranjang
  const handleAddToCart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;

    if (modalCalculatedPrice.actualQty <= 0) {
      alert('Jumlah / bobot timbangan cucian harus lebih besar dari 0');
      return;
    }

    const totalLinePrice = modalCalculatedPrice.subtotal + addonsCalculation.total;

    const newItem: CartItem = {
      id: `${selectedService.id}-${Date.now()}`,
      serviceId: selectedService.id,
      name: selectedService.name,
      category: selectedService.category,
      unit: selectedService.unit || 'Kg',
      unitPrice: modalCalculatedPrice.unitPrice,
      quantity: modalCalculatedPrice.billedQty,
      actualQuantity: modalCalculatedPrice.actualQty,
      isUnderMinimum: modalCalculatedPrice.isUnderMinimum,
      minOrderQty: modalCalculatedPrice.minQty,
      totalPieces: parseInt(itemPieces, 10) || 1,
      perfumeVariant: itemPerfume,
      estimatedReadyHours: modalCalculatedPrice.hours,
      notes: itemNotes.trim(),
      subtotal: totalLinePrice,
      addons: addonsCalculation.items,
    };

    setCartItems((prev) => [...prev, newItem]);
    setModalOpen(false);
    setSelectedService(null);
    setSelectedAddonIds([]);
  };

  const handleRemoveFromCart = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Total Finansial Keranjang
  const cartTotals = useMemo(() => {
    let subtotal = 0;
    let totalKg = 0;
    let totalPcs = 0;
    let maxHours = 24;

    cartItems.forEach((item) => {
      subtotal += item.subtotal;
      if (item.unit === 'KG') {
        totalKg += item.actualQuantity; // total bobot aktual fisik
      }
      totalPcs += item.totalPieces;
      if (item.estimatedReadyHours > maxHours) {
        maxHours = item.estimatedReadyHours;
      }
    });

    const readyDate = new Date(Date.now() + maxHours * 3600 * 1000);

    // 1. Diskon Voucher Terkelola (Pilar 2)
    let promoDiscount = 0;
    if (appliedPromotion) {
      if (appliedPromotion.discountType === 'PERCENTAGE') {
        promoDiscount = Math.floor((subtotal * Number(appliedPromotion.discountValue)) / 100);
        if (appliedPromotion.maxDiscountAmount) {
          promoDiscount = Math.min(promoDiscount, Number(appliedPromotion.maxDiscountAmount));
        }
      } else if (appliedPromotion.discountType === 'FIXED_AMOUNT') {
        promoDiscount = Math.min(subtotal, Number(appliedPromotion.discountValue));
      }
    }

    // 2. Diskon Manual Kasir
    const numDisc = parseFloat(discountValue.replace(/[^0-9]/g, '')) || 0;
    const manualDiscount =
      discountType === 'PERCENT'
        ? Math.round((subtotal * Math.min(100, numDisc)) / 100)
        : Math.min(subtotal, numDisc);

    // 3. Diskon Tukar Poin Member (Pilar 3) - Maksimal 50% Subtotal & tidak melebihi sisa tagihan
    const availablePoints = Number(selectedCustomer?.loyaltyPoints || 0);
    const maxRedeemablePoints = Math.min(
      availablePoints,
      Math.floor((subtotal * 0.5) / pointValueIdr),
      Math.floor(Math.max(0, subtotal - promoDiscount - manualDiscount) / pointValueIdr)
    );
    const safePointsToRedeem = Math.min(Math.max(0, pointsToRedeem), maxRedeemablePoints);
    const pointDiscount = safePointsToRedeem * pointValueIdr;

    // Total Diskon Gabungan (Maksimal sebesar Subtotal)
    const combinedDiscountRaw = promoDiscount + manualDiscount + pointDiscount;
    const calculatedDiscount = Math.min(subtotal, combinedDiscountRaw);

    let effectiveDeliveryFee = 0;
    let isFreeDelivery = false;
    let freeDeliveryReason = '';

    if (deliveryType !== 'NONE') {
      const zones = deliveryConfig?.zones || [];
      const selectedZone = zones.find((z) => z.id === deliveryZoneId) || zones[0];
      const baseFee = selectedZone ? Number(selectedZone.fee) : 10000;
      const multiplier = deliveryType === 'PICKUP_AND_DELIVERY' ? (deliveryConfig?.roundTripMultiplier || 1.8) : 1;
      const calculatedFee = Math.round(baseFee * multiplier);

      if (deliveryConfig?.freeDeliveryMinAmount && subtotal >= Number(deliveryConfig.freeDeliveryMinAmount)) {
        isFreeDelivery = true;
        freeDeliveryReason = `Min. Rp ${Number(deliveryConfig.freeDeliveryMinAmount).toLocaleString('id-ID')}`;
        effectiveDeliveryFee = 0;
      } else if (deliveryConfig?.freeDeliveryMinWeightKg && totalKg >= Number(deliveryConfig.freeDeliveryMinWeightKg)) {
        isFreeDelivery = true;
        freeDeliveryReason = `Min. ${Number(deliveryConfig.freeDeliveryMinWeightKg)} Kg`;
        effectiveDeliveryFee = 0;
      } else {
        effectiveDeliveryFee = calculatedFee;
      }
    }

    const grandTotal = Math.max(0, subtotal - calculatedDiscount) + effectiveDeliveryFee;

    return {
      subtotal,
      deliveryFee: effectiveDeliveryFee,
      isFreeDelivery,
      freeDeliveryReason,
      promoDiscount,
      manualDiscount,
      pointDiscount,
      safePointsToRedeem,
      availablePoints,
      maxRedeemablePoints,
      discountAmount: calculatedDiscount,
      grandTotal,
      totalKg: Number(totalKg.toFixed(2)),
      totalPcs,
      maxHours,
      readyDate,
    };
  }, [
    cartItems,
    discountType,
    discountValue,
    deliveryType,
    deliveryZoneId,
    deliveryConfig,
    appliedPromotion,
    pointsToRedeem,
    selectedCustomer,
    pointValueIdr,
  ]);

  // Transaksi Baru (Reset Form & Keranjang)
  const handleNewTransaction = () => {
    if (cartItems.length > 0) {
      if (!window.confirm('Kosongkan keranjang kasir dan mulai transaksi baru?')) return;
    }
    setCartItems([]);
    handleResetCustomer();
    setCashReceived('');
    setDepositAmount('0');
    setPaymentChoice('PAID');
    setPaymentMethod('CASH');
    setDiscountValue('0');
    setShowDiscountInput(false);
    setAppliedPromotion(null);
    setPointsToRedeem(0);
    setDeliveryType('NONE');
    setDeliveryAddress('');
    setDeliveryNotes('');
  };

  // Listener Shortcut Keyboard Kasir (F1: Transaksi Baru, F2: Cari Member / Selesaikan Transaksi, F8: X-Report, F9: Tutup Shift, Esc: Tutup Modal)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        handleNewTransaction();
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (!isCustomerFilled) {
          setCustomerSearchModalOpen(true);
        } else {
          handleProcessOrder();
        }
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (currentShift) {
          setXReportModalOpen(true);
        } else {
          setFeedbackToast({ message: '⚠️ Buka shift kasir terlebih dahulu untuk melihat X-Report.', type: 'error' });
          setStartShiftModalOpen(true);
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (currentShift) {
          handleOpenCloseShift();
        } else {
          setFeedbackToast({ message: '⚠️ Tidak ada shift aktif untuk ditutup.', type: 'error' });
        }
      } else if (e.key === 'Escape') {
        if (customerSearchModalOpen) setCustomerSearchModalOpen(false);
        else if (quickAddModalOpen) setQuickAddModalOpen(false);
        else if (modalOpen) setModalOpen(false);
        else if (topupModalOpen) setTopupModalOpen(false);
        else if (startShiftModalOpen) setStartShiftModalOpen(false);
        else if (closeShiftModalOpen) setCloseShiftModalOpen(false);
        else if (xReportModalOpen) setXReportModalOpen(false);
        else if (cashExpenseModalOpen) setCashExpenseModalOpen(false);
        else if (voucherModalOpen) setVoucherModalOpen(false);
        else if (staffAttendanceModalOpen) setStaffAttendanceModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    cartItems,
    customerName,
    activeOutlet,
    modalOpen,
    cartTotals,
    paymentChoice,
    depositAmount,
    paymentMethod,
    isCustomerFilled,
    customerSearchModalOpen,
    quickAddModalOpen,
    currentShift,
    topupModalOpen,
    startShiftModalOpen,
    closeShiftModalOpen,
    xReportModalOpen,
    cashExpenseModalOpen,
    voucherModalOpen,
    staffAttendanceModalOpen,
  ]);

  // Nilai Uang Diterima & Kembalian
  const numCashReceived = parseFloat(cashReceived.replace(/[^0-9]/g, '')) || 0;
  const numDeposit = parseFloat(depositAmount.replace(/[^0-9]/g, '')) || 0;
  const targetPayAmount =
    paymentChoice === 'PAID'
      ? cartTotals.grandTotal
      : paymentChoice === 'PARTIAL'
      ? numDeposit
      : 0;
  const changeAmount = paymentMethod === 'CASH' && paymentChoice === 'PAID' ? Math.max(0, numCashReceived - targetPayAmount) : 0;

  // Eksekusi Pembuatan Transaksi Laundry
  const handleProcessOrder = async () => {
    if (!currentShift) {
      alert('Buka shift kasir terlebih dahulu untuk mulai melayani transaksi cucian!');
      setStartShiftModalOpen(true);
      return;
    }
    if (cartItems.length === 0) {
      alert('Pilih minimal satu layanan laundry ke keranjang!');
      return;
    }
    if (!customerName.trim()) {
      alert('Nama pelanggan wajib diisi!');
      return;
    }

    if (!activeOutlet?.id) {
      alert('Toko fisik aktif tidak ditemukan');
      return;
    }

    const isDigitalOrWallet = paymentChoice !== 'UNPAID' && (
      paymentMethod === 'QRIS' ||
      paymentMethod === 'TRANSFER' ||
      paymentMethod === 'CUSTOMER_DEPOSIT' ||
      paymentMethod === 'LAUNDRY_QUOTA'
    );

    if (!navigator.onLine && isDigitalOrWallet) {
      alert('Pembayaran digital/wallet memerlukan koneksi internet aktif. Gunakan metode Tunai atau Bayar Nanti saat offline.');
      return;
    }

    setProcessingOrder(true);
    const clientUuid = generateIdempotencyKey();

    const fullNotes = cartItems.map((i) => i.notes).filter(Boolean).join('; ');
    const zones = deliveryConfig?.zones || [];
    const selectedZone = zones.find((z) => z.id === deliveryZoneId) || zones[0];

    const payload = {
      outletId: activeOutlet.id,
      customerId: selectedCustomerId || undefined,
      customerName: customerName.trim(),
      customerPhone: customerPhone ? `+62${customerPhone.replace(/^0+/, '')}` : undefined,
      deliveryType: deliveryType,
      deliveryDistanceKm: 0,
      deliveryFeePerKm: 0,
      deliveryFee: cartTotals.deliveryFee,
      deliveryZoneName: deliveryType !== 'NONE' ? selectedZone?.name : undefined,
      deliveryAddress: deliveryType !== 'NONE' ? deliveryAddress.trim() : undefined,
      deliveryNotes: deliveryType !== 'NONE' ? deliveryNotes.trim() : undefined,
      items: cartItems.map((item) => ({
        serviceId: item.serviceId,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        perfumeVariant: item.perfumeVariant || undefined,
        addons: item.addons || [],
        notes: item.isUnderMinimum
          ? `${item.notes ? `${item.notes}; ` : ''}(Timbangan fisik: ${item.actualQuantity.toFixed(2)} Kg, min order ${item.minOrderQty} Kg)`
          : item.notes || undefined,
      })),
      totalPieces: cartTotals.totalPcs,
      perfumeVariant: cartItems[0]?.perfumeVariant || 'Lavender',
      estimatedReadyHours: cartTotals.maxHours,
      depositAmount: paymentChoice === 'PAID' ? cartTotals.grandTotal : paymentChoice === 'PARTIAL' ? numDeposit : 0,
      discountAmount: cartTotals.discountAmount,
      manualDiscountAmount: cartTotals.manualDiscount > 0 ? cartTotals.manualDiscount : undefined,
      promotionId: appliedPromotion?.id,
      promoCode: appliedPromotion?.code,
      pointsToRedeem: cartTotals.safePointsToRedeem > 0 ? cartTotals.safePointsToRedeem : undefined,
      paymentMethod: paymentChoice === 'UNPAID' ? 'UNPAID' : paymentMethod,
      customerNotes: fullNotes || undefined,
    };

    const completeOfflineLaundryOrder = async () => {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const tempInvoice = `LD-OFFLINE-${dateStr}-${randomSuffix}`;
      const offlineRefId = `offline-laundry-${Date.now()}-${randomSuffix}`;

      const tempOrderData: LaundryQueueOrder = {
        id: offlineRefId,
        orderId: offlineRefId,
        invoiceNumber: tempInvoice,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() ? `+62${customerPhone.replace(/^0+/, '')}` : null,
        customerAddress: deliveryType !== 'NONE' ? deliveryAddress.trim() || null : null,
        deliveryType: deliveryType,
        deliveryDistanceKm: 0,
        deliveryFee: cartTotals.deliveryFee,
        status: 'RECEIVED',
        currentStage: 'DROP_OFF',
        serviceName: cartItems[0]?.name || 'Layanan Laundry',
        totalWeightKg: cartTotals.totalKg,
        totalPieces: cartTotals.totalPcs,
        perfumeVariant: cartItems[0]?.perfumeVariant || 'Lavender',
        rackCode: null,
        grandTotal: cartTotals.grandTotal,
        paidAmount: paymentChoice === 'PAID' ? cartTotals.grandTotal : paymentChoice === 'PARTIAL' ? numDeposit : 0,
        paymentStatus: paymentChoice === 'PAID' ? 'PAID' : paymentChoice === 'PARTIAL' ? 'PARTIALLY_PAID' : 'UNPAID',
        createdAt: now.toISOString(),
        estimatedReadyAt: cartTotals.readyDate.toISOString(),
        customerNotes: fullNotes || null,
        items: cartItems.map((c) => ({
          name: c.name,
          quantity: c.quantity,
          unit: c.unit,
          unitPrice: c.unitPrice,
          subtotal: c.subtotal,
          notes: c.notes,
          addons: c.addons,
        })),
      };

      await saveOfflineOrder({
        offlineId: offlineRefId,
        orderKind: 'LAUNDRY',
        clientRequestId: clientUuid,
        createdAt: now.toISOString(),
        outletId: activeOutlet?.id,
        shiftId: currentShift?.id,
        cashierName: currentUser?.name || 'Kasir Laundry',
        payload: {
          ...payload,
          offlineReferenceId: offlineRefId,
          clientRequestId: clientUuid,
        },
        tempOrder: tempOrderData,
        status: 'PENDING',
        retryCount: 0,
      });

      setCompletedOrder(tempOrderData);
      setReceiptModalOpen(true);
      setMobileCartSheetOpen(false);

      // Reset keranjang untuk transaksi berikutnya
      setCartItems([]);
      handleResetCustomer();
      setCashReceived('');
      setDepositAmount('0');
      setPaymentChoice('PAID');
      setDiscountValue('0');
      setShowDiscountInput(false);
      setAppliedPromotion(null);
      setPointsToRedeem(0);
      setDeliveryType('NONE');
      setDeliveryAddress('');
      setDeliveryNotes('');

      await refreshOfflineQueueCount();

      setFeedbackToast({
        message: `Faktur #${tempInvoice} tersimpan di antrean offline. Struk & label siap dicetak!`,
        type: 'success',
      });
      setTimeout(() => setFeedbackToast(null), 4000);
    };

    if (!navigator.onLine) {
      await completeOfflineLaundryOrder();
      setProcessingOrder(false);
      return;
    }

    try {
      const res = await api.createLaundryOrder(
        { ...payload, clientRequestId: clientUuid },
        { idempotencyKey: clientUuid }
      );

      if (res.status === 'success' && res.data) {
        const orderData = res.data;
        const newQueueOrder: LaundryQueueOrder = {
          id: orderData.id,
          orderId: orderData.id,
          invoiceNumber: orderData.invoiceNumber,
          customerName: orderData.customer?.name || customerName.trim(),
          customerPhone: orderData.customer?.phone || customerPhone.trim() || null,
          customerAddress: deliveryType !== 'NONE' ? deliveryAddress.trim() || null : null,
          deliveryType: deliveryType,
          deliveryDistanceKm: 0,
          deliveryFee: cartTotals.deliveryFee,
          status: orderData.laundryDetail?.status || 'RECEIVED',
          currentStage: (orderData.laundryDetail as any)?.currentStage || 'DROP_OFF',
          serviceName: cartItems[0]?.name || 'Layanan Laundry',
          totalWeightKg: orderData.laundryDetail?.totalWeightKg ? Number(orderData.laundryDetail.totalWeightKg) : cartTotals.totalKg,
          totalPieces: orderData.laundryDetail?.totalPieces || cartTotals.totalPcs,
          perfumeVariant: orderData.laundryDetail?.perfumeVariant || 'Lavender',
          rackCode: orderData.laundryDetail?.rackCode || null,
          grandTotal: Number(orderData.totalAmount),
          paidAmount: Number(orderData.paidAmount || (paymentChoice === 'PAID' ? cartTotals.grandTotal : paymentChoice === 'PARTIAL' ? numDeposit : 0)),
          paymentStatus: orderData.paymentStatus,
          createdAt: orderData.createdAt,
          estimatedReadyAt: orderData.laundryDetail?.estimatedReadyAt || cartTotals.readyDate.toISOString(),
          customerNotes: orderData.notes || fullNotes || null,
          items: cartItems.map((c) => ({
            name: c.name,
            quantity: c.quantity,
            unit: c.unit,
            unitPrice: c.unitPrice,
            subtotal: c.subtotal,
            notes: c.notes,
            addons: c.addons,
          })),
        };

        setCompletedOrder(newQueueOrder);
        setReceiptModalOpen(true);
        setMobileCartSheetOpen(false);

        // Reset keranjang untuk transaksi berikutnya
        setCartItems([]);
        handleResetCustomer();
        setCashReceived('');
        setDepositAmount('0');
        setPaymentChoice('PAID');
        setDiscountValue('0');
        setShowDiscountInput(false);
        setAppliedPromotion(null);
        setPointsToRedeem(0);
        setDeliveryType('NONE');
        setDeliveryAddress('');
        setDeliveryNotes('');

        // Refresh CRM list & Shift status
        fetchCustomers();
        loadCurrentShift();

        setFeedbackToast({
          message: `Nota ${newQueueOrder.invoiceNumber} berhasil dicatat & masuk antrean!`,
          type: 'success',
        });
        setTimeout(() => setFeedbackToast(null), 4000);
      } else {
        alert(res.message || 'Gagal memproses transaksi laundry');
      }
    } catch (err: any) {
      const isNetworkFailure =
        !navigator.onLine ||
        err?.name === 'TypeError' ||
        String(err?.message || '').toLowerCase().includes('fetch') ||
        String(err?.message || '').toLowerCase().includes('network');

      if (isNetworkFailure && !isDigitalOrWallet) {
        try {
          await completeOfflineLaundryOrder();
        } catch {
          alert(err.message || 'Terjadi kesalahan sistem saat memproses transaksi');
        }
      } else {
        alert(err.message || 'Terjadi kesalahan sistem saat memproses transaksi');
      }
    } finally {
      setProcessingOrder(false);
    }
  };

  const renderCartBody = () => (
    <>
          {/* Header Status Pelanggan Terpilih */}
          <div className="p-3 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold shrink-0 ${
                  isCustomerFilled
                    ? "bg-blue-100 text-blue-900 border border-blue-200"
                    : "bg-slate-100 text-slate-400"
                }`}
              >
                <User className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-black text-slate-900 truncate">
                    {isCustomerFilled ? customerName : "Belum Ada Pelanggan"}
                  </span>
                  {selectedCustomerId && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                      Member CRM
                    </span>
                  )}
                  {selectedCustomerId && selectedCustomer && isLoyaltyActive && (
                    <span className="text-[9px] font-black px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-0.5 shrink-0">
                      <Star className="w-2.5 h-2.5 text-amber-600 fill-amber-500" />
                      <span>{Number(selectedCustomer.loyaltyPoints || 0).toLocaleString('id-ID')} Poin</span>
                      {selectedCustomer.tier && <span className="opacity-75">({selectedCustomer.tier})</span>}
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {isCustomerFilled
                    ? customerPhone
                      ? `+62 ${customerPhone.replace(/^\+?62/, '')}`
                      : 'Tanpa No. WhatsApp'
                    : 'Klik layanan untuk input nama'}
                </div>
                {selectedCustomerId && (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {loadingWallet ? (
                        <span className="text-[9.5px] text-slate-400 flex items-center gap-1">
                          <Loader2 className="w-3 h-3 animate-spin text-blue-900" />
                          <span>Memuat dompet...</span>
                        </span>
                      ) : (
                        <>
                          <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-900 border border-blue-200">
                            Saldo: Rp {Number(customerWallet?.balanceAmount || 0).toLocaleString('id-ID')}
                          </span>
                          <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-900 border border-purple-200">
                            Kuota: {Number(customerWallet?.quotaKg || 0)} Kg
                          </span>
                          <button
                            type="button"
                            onClick={() => setTopupModalOpen(true)}
                            className="text-[9.5px] font-black text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors"
                            title="Top-up saldo atau kuota pelanggan"
                          >
                            + Top-up
                          </button>
                          <button
                            type="button"
                            onClick={() => setPrefModalOpen(true)}
                            className="text-[9.5px] font-black text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-1.5 py-0.5 rounded-md cursor-pointer transition-colors flex items-center gap-1"
                            title="Atur preferensi laundry & nomor alternatif pelanggan"
                          >
                            <Sliders className="w-2.5 h-2.5 text-blue-800" />
                            <span>Preferensi</span>
                          </button>
                        </>
                      )}
                    </div>
                    {selectedCustomer?.laundryPreferences && (
                      <CustomerPreferenceBadges preferences={selectedCustomer.laundryPreferences} />
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {isCustomerFilled ? (
                <button
                  type="button"
                  onClick={handleResetCustomer}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-500 hover:text-rose-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Ganti / Reset Pelanggan"
                >
                  Ganti
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setCustomerSearchModalOpen(true)}
                  className="px-2.5 py-1 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                >
                  <Search className="w-3 h-3" />
                  <span>Pilih (F2)</span>
                </button>
              )}
            </div>
          </div>

          {/* Daftar Item di Keranjang */}
          <div className="flex-1 p-3 overflow-y-auto space-y-2">
            <div className="flex items-center justify-between pb-1 border-b border-slate-200">
              <span className="text-xs font-bold text-slate-700">
                Item Cucian ({cartItems.length})
              </span>
              {cartItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCartItems([])}
                  className="text-[11px] text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Kosongkan
                </button>
              )}
            </div>

            {cartItems.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs space-y-1">
                <Shirt className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600">Keranjang Masih Kosong</p>
                <p className="text-[11px]">Klik salah satu layanan di sebelah kiri untuk mulai menimbang atau memasukkan cucian.</p>
              </div>
            ) : (
              cartItems.map((item) => (
                <div
                  key={item.id}
                  className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 leading-snug">{item.name}</h4>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="font-bold text-slate-800">
                          {item.quantity.toFixed(2)} {item.unit}
                        </span>
                        {item.isUnderMinimum && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[9px] font-black border border-amber-300">
                            Min. {item.minOrderQty} Kg (Asli: {item.actualQuantity.toFixed(2)} Kg)
                          </span>
                        )}
                        <span>•</span>
                        <span>{item.totalPieces} Pcs</span>
                        <span>•</span>
                        <span className="text-blue-700 font-medium">{item.perfumeVariant}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromCart(item.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      title="Hapus Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {item.addons && item.addons.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {item.addons.map((ad) => (
                        <span
                          key={ad.id}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-purple-50 text-purple-900 text-[9.5px] font-bold border border-purple-200"
                        >
                          ✨ {ad.name} (+Rp {ad.total.toLocaleString('id-ID')})
                        </span>
                      ))}
                    </div>
                  )}

                  {item.notes && (
                    <div className="p-1 rounded bg-amber-50 border border-amber-200 text-[10px] text-amber-900">
                      Catatan: {item.notes}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400">
                      @ Rp {item.unitPrice.toLocaleString('id-ID')}
                    </span>
                    <span className="font-black text-slate-900">
                      Rp {item.subtotal.toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Ringkasan Finansial & Opsi Pembayaran */}
          <div className="bg-white border-t border-slate-200 p-3 space-y-2.5 shadow-lg shrink-0">
            {/* Info Estimasi Selesai */}
            {cartItems.length > 0 && (
              <div className="p-2 rounded-xl bg-blue-50/80 border border-blue-200 flex items-center justify-between text-xs text-blue-950">
                <span className="flex items-center gap-1 font-semibold">
                  <Clock className="w-3.5 h-3.5 text-blue-700" />
                  Estimasi Selesai:
                </span>
                <span className="font-black text-blue-900">
                  {cartTotals.readyDate.toLocaleDateString('id-ID', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}

            {/* Opsi Pengantaran & Penjemputan Pelanggan (Delivery) */}
            <div className="space-y-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-800 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-blue-900" />
                  <span>Moda Antar-Jemput</span>
                </label>
                {deliveryType !== 'NONE' && (
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                    cartTotals.isFreeDelivery
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-blue-100 text-blue-900'
                  }`}>
                    {cartTotals.isFreeDelivery ? `Gratis Ongkir (${cartTotals.freeDeliveryReason})` : `Ongkir: Rp ${cartTotals.deliveryFee.toLocaleString('id-ID')}`}
                  </span>
                )}
              </div>

              {/* Segmented Button Tipe Delivery */}
              <div className="grid grid-cols-4 gap-1">
                {[
                  { key: 'NONE', label: 'Ambil Sendiri' },
                  { key: 'PICKUP_ONLY', label: 'Jemput Saja' },
                  { key: 'DELIVERY_ONLY', label: 'Antar Saja' },
                  { key: 'PICKUP_AND_DELIVERY', label: 'Jemput & Antar' },
                ].map((dt) => (
                  <button
                    key={dt.key}
                    type="button"
                    onClick={() => setDeliveryType(dt.key as any)}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-bold border transition-all text-center leading-tight cursor-pointer ${
                      deliveryType === dt.key
                        ? 'bg-blue-900 text-white border-blue-900 shadow-2xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {dt.label}
                  </button>
                ))}
              </div>

              {/* Detail Zona & Alamat jika bukan Ambil Sendiri */}
              {deliveryType !== 'NONE' && (
                <div className="pt-2 border-t border-slate-200/80 space-y-2 animate-fadeIn">
                  {deliveryConfig?.zones && deliveryConfig.zones.length > 0 && (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600">Pilih Zona / Tarif Antar</label>
                      <div className="relative">
                        <select
                          value={deliveryZoneId}
                          onChange={(e) => setDeliveryZoneId(e.target.value)}
                          className="w-full appearance-none pr-10 pl-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-900"
                        >
                          {deliveryConfig.zones.map((z) => (
                            <option key={z.id} value={z.id}>
                              {z.name} — Rp {Number(z.fee).toLocaleString('id-ID')}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2" />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600">Alamat Lengkap Pengantaran / Penjemputan</label>
                    <textarea
                      rows={2}
                      placeholder="Masukkan alamat lengkap (jalan, nomor, patokan rumah)..."
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-900 resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-600">Catatan Khusus Kurir (Opsional)</label>
                    <input
                      type="text"
                      placeholder="Contoh: Tolong jemput sebelum jam 2 siang, pagar hitam"
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-900"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Skema Bayar */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-700">
                Status Pembayaran Kasir
              </label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { key: 'PAID', label: 'Lunas di Awal', color: 'border-emerald-500 bg-emerald-50 text-emerald-900' },
                  { key: 'PARTIAL', label: 'Uang Muka (DP)', color: 'border-amber-500 bg-amber-50 text-amber-900' },
                  { key: 'UNPAID', label: 'Bayar di Akhir', color: 'border-slate-400 bg-slate-100 text-slate-800' },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setPaymentChoice(opt.key as any)}
                    className={`py-1.5 px-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      paymentChoice === opt.key ? `${opt.color} shadow-xs ring-1 ring-blue-900` : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Jika DP: Input Nominal DP */}
            {paymentChoice === 'PARTIAL' && (
              <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 space-y-1">
                <label className="block text-[10px] font-bold text-amber-900">
                  Nominal Uang Muka / DP (Rp)
                </label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="20000"
                  className="w-full px-2 py-1 text-xs rounded-lg border border-amber-300 bg-white font-bold"
                />
                <div className="text-[10px] text-amber-800 flex justify-between">
                  <span>Sisa Tagihan saat Ambil:</span>
                  <span className="font-extrabold">
                    Rp {Math.max(0, cartTotals.grandTotal - (parseFloat(depositAmount) || 0)).toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )}

            {/* Metode Bayar (jika ada uang diterima) */}
            {paymentChoice !== 'UNPAID' && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  {[
                    { key: 'CASH', label: 'Tunai', isCash: true },
                    { key: 'QRIS', label: 'QRIS', icon: QrCode },
                    { key: 'TRANSFER', label: 'Transfer', icon: CreditCard },
                  ]
                    .filter((m) => m.key !== 'QRIS' || isQrisActive)
                    .map((m) => {
                    const Icon = (m as any).icon;
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setPaymentMethod(m.key as any)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold border flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                          paymentMethod === m.key
                            ? 'bg-blue-900 border-blue-900 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {m.isCash ? (
                          <span className="font-black text-[11px] leading-none px-1.5 py-0.5 rounded bg-blue-800 text-white">
                            Rp
                          </span>
                        ) : (
                          Icon && <Icon className="w-3.5 h-3.5" />
                        )}
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Opsi Pembayaran via Saldo Deposit atau Kuota Kiloan Pelanggan */}
                {selectedCustomerId && customerWallet && (
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    {/* Tombol Saldo Deposit */}
                    <button
                      type="button"
                      disabled={Number(customerWallet.balanceAmount) <= 0}
                      onClick={() => setPaymentMethod('CUSTOMER_DEPOSIT')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border flex items-center justify-between transition-all cursor-pointer ${
                        paymentMethod === 'CUSTOMER_DEPOSIT'
                          ? 'bg-blue-950 border-blue-950 text-white shadow-xs'
                          : Number(customerWallet.balanceAmount) > 0
                          ? 'bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100'
                          : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                      }`}
                      title={
                        Number(customerWallet.balanceAmount) <= 0
                          ? 'Saldo deposit kosong'
                          : `Gunakan Saldo (Tersedia: Rp ${Number(customerWallet.balanceAmount).toLocaleString('id-ID')})`
                      }
                    >
                      <span className="flex items-center gap-1 truncate">
                        <Wallet className="w-3.5 h-3.5 shrink-0" />
                        <span>Saldo Deposit</span>
                      </span>
                      <span className="font-extrabold text-[10px] shrink-0">
                        Rp {Math.floor(Number(customerWallet.balanceAmount)).toLocaleString('id-ID')}
                      </span>
                    </button>

                    {/* Tombol Kuota Kiloan */}
                    <button
                      type="button"
                      disabled={Number(customerWallet.quotaKg) <= 0}
                      onClick={() => setPaymentMethod('LAUNDRY_QUOTA')}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border flex items-center justify-between transition-all cursor-pointer ${
                        paymentMethod === 'LAUNDRY_QUOTA'
                          ? 'bg-purple-950 border-purple-950 text-white shadow-xs'
                          : Number(customerWallet.quotaKg) > 0
                          ? 'bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100'
                          : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed'
                      }`}
                      title={
                        Number(customerWallet.quotaKg) <= 0
                          ? 'Kuota kiloan kosong'
                          : `Gunakan Kuota (Tersedia: ${Number(customerWallet.quotaKg)} Kg)`
                      }
                    >
                      <span className="flex items-center gap-1 truncate">
                        <Sparkles className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <span>Kuota Kiloan</span>
                      </span>
                      <span className="font-extrabold text-[10px] shrink-0">
                        {Number(customerWallet.quotaKg)} Kg
                      </span>
                    </button>
                  </div>
                )}

                {/* Kartu Pratinjau QRIS Statis (Pilar 1 - Gelombang 2) */}
                {paymentMethod === 'QRIS' && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-fadeIn text-center">
                    {qrisImageUrl ? (
                      <div className="flex flex-col items-center">
                        <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-xs inline-block">
                          <img
                            src={qrisImageUrl}
                            alt="Barcode QRIS Toko"
                            className="w-36 h-36 max-h-[180px] object-contain rounded-lg"
                          />
                        </div>
                        <div className="mt-1.5 space-y-0.5">
                          {qrisConfig?.merchantName && (
                            <p className="text-xs font-black text-slate-800 uppercase tracking-tight">
                              {qrisConfig.merchantName}
                            </p>
                          )}
                          {qrisConfig?.nmid && (
                            <p className="text-[10px] font-mono text-slate-500 font-bold">
                              NMID: {qrisConfig.nmid}
                            </p>
                          )}
                          <p className="text-xs font-black text-blue-900 pt-0.5">
                            Tagihan: Rp {targetPayAmount.toLocaleString('id-ID')}
                          </p>
                        </div>
                        <p className="text-[10.5px] text-slate-500 font-medium mt-1 leading-tight">
                          Minta pelanggan scan QRIS lalu pastikan dana masuk sebelum konfirmasi.
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col items-center gap-1.5 text-center">
                        <QrCode className="w-8 h-8 text-amber-500" />
                        <p className="text-xs font-bold text-amber-900">
                          Barcode QRIS Belum Dikonfigurasi
                        </p>
                        <p className="text-[10.5px] text-amber-700 leading-tight">
                          Unggah foto/gambar QRIS toko pada menu Pengaturan Pembayaran agar pelanggan bisa scan QRIS di kasir.
                        </p>
                        <button
                          type="button"
                          onClick={() => onNavigateTab('settings_payment')}
                          className="mt-1 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors cursor-pointer"
                        >
                          Buka Pengaturan Pembayaran
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Info Pemakaian Saldo Deposit Pelanggan */}
            {paymentChoice !== 'UNPAID' && paymentMethod === 'CUSTOMER_DEPOSIT' && (
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-xs space-y-1 animate-fadeIn">
                <div className="flex items-center justify-between font-bold text-blue-950">
                  <span className="flex items-center gap-1.5">
                    <Wallet className="w-4 h-4 text-blue-700" />
                    <span>Saldo Deposit Pelanggan</span>
                  </span>
                  <span>Rp {Number(customerWallet?.balanceAmount || 0).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-blue-800">
                  <span>Dipotong untuk transaksi ini:</span>
                  <span className="font-black text-rose-600">- Rp {targetPayAmount.toLocaleString('id-ID')}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-blue-200 font-extrabold text-blue-950">
                  <span>Sisa Saldo Deposit Nanti:</span>
                  <span className={Number(customerWallet?.balanceAmount || 0) < targetPayAmount ? 'text-rose-600' : 'text-emerald-700'}>
                    Rp {Math.max(0, Number(customerWallet?.balanceAmount || 0) - targetPayAmount).toLocaleString('id-ID')}
                  </span>
                </div>
                {Number(customerWallet?.balanceAmount || 0) < targetPayAmount && (
                  <p className="text-[10px] font-bold text-rose-600 pt-0.5">
                    ⚠️ Saldo tidak cukup. Silakan top-up terlebih dahulu atau pilih metode lain.
                  </p>
                )}
              </div>
            )}

            {/* Info Pemakaian Kuota Kiloan Pelanggan */}
            {paymentChoice !== 'UNPAID' && paymentMethod === 'LAUNDRY_QUOTA' && (
              <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-200 text-xs space-y-1 animate-fadeIn">
                <div className="flex items-center justify-between font-bold text-purple-950">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-700" />
                    <span>Kuota Kiloan Pelanggan</span>
                  </span>
                  <span>{Number(customerWallet?.quotaKg || 0)} Kg</span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-purple-800">
                  <span>Dipotong untuk cucian ini:</span>
                  <span className="font-black text-purple-950">
                    - {cartTotals.totalKg > 0 ? cartTotals.totalKg : 1} Kg
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-purple-200 font-extrabold text-purple-950">
                  <span>Sisa Kuota Nanti:</span>
                  <span className={Number(customerWallet?.quotaKg || 0) < (cartTotals.totalKg > 0 ? cartTotals.totalKg : 1) ? 'text-rose-600' : 'text-emerald-700'}>
                    {Math.max(
                      0,
                      Number(customerWallet?.quotaKg || 0) - (cartTotals.totalKg > 0 ? cartTotals.totalKg : 1)
                    )}{' '}
                    Kg
                  </span>
                </div>
                {Number(customerWallet?.quotaKg || 0) < (cartTotals.totalKg > 0 ? cartTotals.totalKg : 1) && (
                  <p className="text-[10px] font-bold text-rose-600 pt-0.5">
                    ⚠️ Kuota kiloan tidak mencukupi bobot cucian.
                  </p>
                )}
              </div>
            )}

            {/* Input Uang Tunai Diterima jika Cash Lunas */}
            {paymentChoice === 'PAID' && paymentMethod === 'CASH' && (
              <div className="space-y-1 pt-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                  <span>Uang Tunai Diterima</span>
                  {numCashReceived > 0 && numCashReceived >= targetPayAmount && (
                    <span className="text-emerald-700">Kembalian: Rp {changeAmount.toLocaleString('id-ID')}</span>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Contoh: 50.000"
                  value={cashReceived}
                  onChange={(e) => setCashReceived(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 font-extrabold focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
                <div className="flex gap-1 overflow-x-auto">
                  {[targetPayAmount, 20000, 50000, 100000].map((amt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCashReceived(String(amt))}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-bold text-slate-700 whitespace-nowrap cursor-pointer"
                    >
                      {idx === 0 ? 'Uang Pas' : `Rp ${amt.toLocaleString('id-ID')}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 1. Voucher Promo Terkelola (Pilar 2) */}
            <div className="space-y-1.5 pt-1 border-t border-slate-100">
              <label className="block text-[11px] font-bold text-slate-700">
                Voucher &amp; Promo
              </label>
              {appliedPromotion ? (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center justify-between text-xs animate-fadeIn">
                  <div className="flex items-center gap-2 min-w-0">
                    <Ticket className="w-4 h-4 text-emerald-700 shrink-0" />
                    <div className="min-w-0">
                      <span className="font-black text-emerald-950 block truncate">
                        {appliedPromotion.name} ({appliedPromotion.code})
                      </span>
                      <span className="text-[10.5px] text-emerald-700 font-bold">
                        Hemat Rp {cartTotals.promoDiscount.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAppliedPromotion(null)}
                    className="p-1 rounded-lg hover:bg-emerald-200 text-emerald-800 cursor-pointer transition-colors"
                    title="Hapus Voucher"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setVoucherModalOpen(true)}
                  className="w-full py-2 px-3 rounded-xl border border-dashed border-blue-400 bg-blue-50/60 hover:bg-blue-100/60 text-blue-900 text-xs font-bold flex items-center justify-between transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Ticket className="w-4 h-4 text-blue-700" />
                    <span>Pilih / Pakai Voucher Promo</span>
                  </span>
                  <ChevronRight className="w-4 h-4 text-blue-700" />
                </button>
              )}
            </div>

            {/* 2. Tukar Poin Loyalitas Member (Pilar 3) */}
            {isLoyaltyActive && selectedCustomerId && selectedCustomer && cartItems.length > 0 && cartTotals.availablePoints >= minPointsToRedeem && (
              <div className="space-y-1.5 p-2.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs animate-fadeIn">
                <div className="flex items-center justify-between font-bold text-amber-950">
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-500" />
                    <span>Tukar Poin Member</span>
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-extrabold border border-amber-300">
                    Tersedia: {cartTotals.availablePoints.toLocaleString('id-ID')} Poin
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max={cartTotals.maxRedeemablePoints}
                    value={pointsToRedeem || ''}
                    placeholder="0"
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      setPointsToRedeem(Math.min(val, cartTotals.maxRedeemablePoints));
                    }}
                    className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-amber-300 bg-white font-extrabold text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPointsToRedeem(cartTotals.maxRedeemablePoints);
                    }}
                    className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-200 hover:bg-amber-300 text-amber-950 border border-amber-400 cursor-pointer transition-colors"
                  >
                    Pakai Maksimal
                  </button>
                  {pointsToRedeem > 0 && (
                    <button
                      type="button"
                      onClick={() => setPointsToRedeem(0)}
                      className="px-1.5 py-1 rounded-lg text-[10px] font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>Maksimal tukar: {cartTotals.maxRedeemablePoints.toLocaleString('id-ID')} Poin (maks. 50% subtotal)</span>
                </div>

                {cartTotals.pointDiscount > 0 && (
                  <div className="flex items-center justify-between text-[10.5px] text-amber-900 font-bold pt-0.5">
                    <span>Potongan Tagihan Poin:</span>
                    <span className="text-emerald-700 font-black">
                      -Rp {cartTotals.pointDiscount.toLocaleString('id-ID')} ({cartTotals.safePointsToRedeem} Poin)
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 3. Diskon Manual Kasir */}
            <div className="pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowDiscountInput(!showDiscountInput)}
                  className="text-[11px] font-bold text-blue-900 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <Tag className="w-3 h-3" />
                  <span>{showDiscountInput ? 'Sembunyikan Diskon Manual' : '+ Tambah Diskon Manual'}</span>
                </button>
                {cartTotals.manualDiscount > 0 && (
                  <span className="text-xs font-bold text-rose-600">
                    -Rp {cartTotals.manualDiscount.toLocaleString('id-ID')}
                  </span>
                )}
              </div>

              {showDiscountInput && (
                <div className="mt-2 p-2 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 animate-fadeIn">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDiscountType('FIXED')}
                      className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                        discountType === 'FIXED' ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-slate-600'
                      }`}
                    >
                      Nominal (Rp)
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('PERCENT')}
                      className={`flex-1 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                        discountType === 'PERCENT' ? 'bg-blue-900 text-white border-blue-900' : 'bg-white text-slate-600'
                      }`}
                    >
                      Persen (%)
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    placeholder={discountType === 'FIXED' ? 'Nominal diskon Rp...' : 'Persen diskon (cth: 10)...'}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="w-full px-2 py-1 text-xs rounded-lg border border-slate-300 font-bold bg-white"
                  />
                </div>
              )}
            </div>

            {/* Subtotal & Grand Total */}
            <div className="pt-2 border-t border-slate-200 space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Subtotal ({cartItems.length} Layanan):</span>
                <span>Rp {cartTotals.subtotal.toLocaleString('id-ID')}</span>
              </div>
              {deliveryType !== 'NONE' && (
                <div className="flex items-center justify-between text-xs text-blue-900 font-bold">
                  <span>Ongkos Antar-Jemput:</span>
                  <span>
                    {cartTotals.deliveryFee === 0 ? (
                      <span className="text-emerald-700">GRATIS</span>
                    ) : (
                      `Rp ${cartTotals.deliveryFee.toLocaleString('id-ID')}`
                    )}
                  </span>
                </div>
              )}
              {cartTotals.promoDiscount > 0 && (
                <div className="flex items-center justify-between text-xs text-emerald-700 font-bold">
                  <span>Voucher ({appliedPromotion?.code}):</span>
                  <span>-Rp {cartTotals.promoDiscount.toLocaleString('id-ID')}</span>
                </div>
              )}
              {cartTotals.manualDiscount > 0 && (
                <div className="flex items-center justify-between text-xs text-rose-600 font-bold">
                  <span>Diskon Manual:</span>
                  <span>-Rp {cartTotals.manualDiscount.toLocaleString('id-ID')}</span>
                </div>
              )}
              {cartTotals.pointDiscount > 0 && (
                <div className="flex items-center justify-between text-xs text-amber-700 font-bold">
                  <span>Tukar Poin ({cartTotals.safePointsToRedeem} Poin):</span>
                  <span>-Rp {cartTotals.pointDiscount.toLocaleString('id-ID')}</span>
                </div>
              )}
              <div className="flex items-baseline justify-between pt-1 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-900">TOTAL TAGIHAN:</span>
                <span className="text-lg font-black text-blue-900">
                  Rp {cartTotals.grandTotal.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            {/* Tombol Eksekusi Bayar / Simpan Order (F2) */}
            <div className="pt-1 flex items-center justify-between gap-2">
              <div className="text-[10px] text-slate-400 font-semibold leading-tight">
                <span>Shortcut F2:</span>
                <span className="block text-slate-600">Simpan &amp; Cetak</span>
              </div>

              <button
                type="button"
                disabled={processingOrder || cartItems.length === 0}
                onClick={handleProcessOrder}
                className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white font-black text-xs shadow-md shadow-blue-900/20 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <span>{processingOrder ? 'Memproses...' : 'Terima Cucian & Struk (F2)'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
    </>
  );

  return (
    <div className="flex flex-col min-h-[calc(100vh-68px)] lg:h-[calc(100vh-68px)] bg-slate-100 font-sans text-slate-800 pb-20 lg:pb-0">
      {/* 1. Header Toolbar Terminal Kasir Laundry */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 shadow-xs shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold shadow-xs shrink-0">
            <Shirt className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                Kasir Laundry &amp; Cuci Kiloan
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                SmartKasir Mode
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {activeOutlet?.name || 'Toko Aktif'} • Kasir: <span className="font-semibold text-slate-700">{currentUser?.name}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap w-full lg:w-auto shrink-0">
          {/* Shift Controls (Pilar 1) */}
          {!currentShift ? (
            <button
              type="button"
              onClick={() => setStartShiftModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95 animate-pulse"
              title="Buka Shift Kasir Baru"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Buka Shift</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Shift Aktif</span>
              </span>
              <button
                type="button"
                onClick={() => setXReportModalOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                title="X-Report Laporan Berjalan Kasir (F8)"
              >
                <FileText className="w-3.5 h-3.5 text-blue-700" />
                <span className="hidden sm:inline">X-Report (F8)</span>
                <span className="sm:hidden">X-Rep</span>
              </button>
              {canCashOut && (
                <button
                  type="button"
                  onClick={() => setCashExpenseModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                  title="Catat Kas Keluar / Kas Masuk Operasional"
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-amber-700" />
                  <span className="hidden sm:inline">Kas Keluar</span>
                  <span className="sm:hidden">Kas</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenCloseShift}
                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                title="Tutup Shift Kasir & Cetak Z-Report (F9)"
              >
                <Square className="w-3.5 h-3.5 text-rose-700" />
                <span className="hidden sm:inline">Tutup Shift (F9)</span>
                <span className="sm:hidden">Tutup</span>
              </button>
            </div>
          )}

          {/* Absensi Staf Kasir (Pilar 4) */}
          <button
            type="button"
            onClick={() => setStaffAttendanceModalOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-900 border border-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title="Absensi Staf Kasir (Clock-In / Clock-Out)"
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
            <span className="hidden sm:inline">Absensi</span>
          </button>

          {/* Tombol Transaksi Baru F1 */}
          <button
            type="button"
            onClick={handleNewTransaction}
            className="px-3 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
            title="Mulai Transaksi Baru (F1)"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>Transaksi Baru (F1)</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('laundry_queue')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-900 border border-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-blue-700" />
            <span>Antrean Live</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('laundry_racks')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-900 border border-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Archive className="w-3.5 h-3.5 text-emerald-700" />
            <span>Rak Simpan</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('laundry_transfers')}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-900 border border-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Truck className="w-3.5 h-3.5 text-indigo-700" />
            <span>Delivery</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('settings_receipt')}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
            title="Format Struk Thermal"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Banner Status Offline / Pending Sync */}
      {(!isOnline || offlineQueueCount.pending > 0) && (
        <div
          className={`px-4 py-2.5 border-b flex items-center justify-between gap-3 text-xs shrink-0 transition-colors ${
            !isOnline
              ? 'bg-amber-50 border-amber-200 text-amber-950'
              : 'bg-blue-50 border-blue-200 text-blue-950'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {!isOnline ? (
              <WifiOff className="w-4 h-4 text-amber-600 shrink-0 animate-pulse" />
            ) : (
              <CloudUpload className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <div className="truncate">
              <span className="font-extrabold">
                {!isOnline ? 'Mode Offline Aktif' : 'Penyelarasan Data Lokal PWA'}
              </span>
              <span className="ml-2 font-medium">
                {!isOnline
                  ? 'Transaksi tersimpan lokal di browser. Struk & label fisik tetap dapat dicetak.'
                  : `Ada ${offlineQueueCount.pending} transaksi offline yang siap disinkronkan ke server.`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {offlineQueueCount.pending > 0 && (
              <span className="px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-amber-200 text-amber-900">
                {offlineQueueCount.pending} antrean offline
              </span>
            )}
            {isOnline && offlineQueueCount.pending > 0 && (
              <button
                type="button"
                onClick={syncOfflineLaundryOrders}
                disabled={isSyncingOffline}
                className="px-3 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingOffline ? 'animate-spin' : ''}`} />
                <span>{isSyncingOffline ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 2. Main Work Area: 2 Kolom (Katalog Layanan & Keranjang Kasir) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Kolom Kiri: Katalog Layanan Laundry */}
        <section className="flex-1 flex flex-col border-r border-slate-200 bg-white overflow-hidden">
          {/* Search & Dynamic Category Tabs */}
          <div className="p-3 border-b border-slate-200 space-y-2 bg-slate-50/70">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari layanan laundry (cth: Cuci Setrika, Bed Cover, Jas, Karpet, dll)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-900 shadow-2xs font-medium"
                />
              </div>
            </div>

            {/* Tab Kategori Dinamis */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
              {dynamicCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                    activeCategory === cat
                      ? 'bg-blue-900 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {getCategoryLabel(cat)}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Layanan */}
          <div className="flex-1 p-3 pb-28 lg:pb-3 overflow-y-auto">
            {/* Customer-First Guardrail Banner */}
            {!isCustomerFilled && (
              <div className="mb-3.5 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300/80 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 animate-fadeIn">
                <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                    <Lock className="w-4 h-4 text-amber-900" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                        Input Pelanggan
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-amber-950">
                        Tentukan Nama Pelanggan Sebelum Memilih Layanan
                      </h4>
                    </div>
                    <p className="text-[11px] sm:text-xs text-amber-900/90 mt-1 leading-relaxed">
                      Pilih nama pelanggan terlebih dahulu agar nota, berat timbangan, dan riwayat pesanan tercatat dengan benar.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:flex items-center gap-2 w-full lg:w-auto shrink-0 pt-1 lg:pt-0 border-t border-amber-200/60 lg:border-t-0">
                  <button
                    type="button"
                    onClick={() => setCustomerSearchModalOpen(true)}
                    className="h-9 px-3.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Cari (F2)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickAddModalOpen(true)}
                    className="h-9 px-3.5 rounded-xl bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Baru</span>
                  </button>
                </div>
              </div>
            )}

            {loadingServices ? (
              <div className="py-20 text-center text-slate-400 text-xs">
                <span>Memuat katalog layanan laundry...</span>
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="py-20 text-center text-slate-400 text-xs space-y-2">
                <Shirt className="w-8 h-8 mx-auto text-slate-300" />
                <p>Tidak ada layanan yang sesuai.</p>
                <button
                  type="button"
                  onClick={() => onNavigateTab('laundry_services')}
                  className="px-3 py-1 text-xs font-bold text-blue-900 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer"
                >
                  Kelola Daftar Layanan
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {filteredServices.map((srv) => {
                  const isKg = srv.unit === 'KG';
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => handleSelectService(srv)}
                      className={`p-3 rounded-2xl border transition-all text-left flex flex-col justify-between group relative ${
                        isCustomerFilled
                          ? 'border-slate-200 bg-white hover:border-blue-900 hover:shadow-md cursor-pointer'
                          : 'border-slate-200/80 bg-slate-50/70 hover:border-amber-400 hover:bg-amber-50/30 cursor-pointer'
                      }`}
                      title={!isCustomerFilled ? 'Silakan isi data pelanggan terlebih dahulu' : undefined}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span
                            className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              isKg
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {srv.category}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {srv.durationHours} Jam
                          </span>
                        </div>

                        <div className="flex items-start justify-between gap-1">
                          <h3 className="font-extrabold text-xs text-slate-900 group-hover:text-blue-900 transition-colors line-clamp-1">
                            {srv.name}
                          </h3>
                          {!isCustomerFilled && (
                            <span className="shrink-0 text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1.5 py-0.2 rounded-full flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" />
                              <span>Isi Customer</span>
                            </span>
                          )}
                        </div>

                        {srv.description && (
                          <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">
                            {srv.description}
                          </p>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-100 flex items-baseline justify-between">
                        <div>
                          <span className="text-[10px] text-slate-400 font-medium">Tarif / {srv.unit}:</span>
                          <div className="text-sm font-black text-slate-900">
                            Rp {Number(srv.price).toLocaleString('id-ID')}
                          </div>
                        </div>

                        {srv.minOrderQty && Number(srv.minOrderQty) > 1 && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                            Min: {Number(srv.minOrderQty)} {srv.unit}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Kolom Kanan: Kasir Nota & Pembayaran (1/3 Layar di Desktop) */}
        <section className="hidden lg:flex w-[420px] xl:w-[460px] bg-slate-50 border-l border-slate-200 flex-col overflow-hidden shrink-0">
          {renderCartBody()}
        </section>
      </div>

      {/* Mobile Slide-Up Cart Bottom Sheet (< lg) */}
      {mobileCartSheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-slate-900/60 backdrop-blur-xs transition-opacity animate-fadeIn">
          <div className="w-full bg-slate-50 rounded-t-3xl max-h-[88dvh] flex flex-col shadow-2xl border-t border-slate-200 overflow-hidden animate-slideUp">
            {/* Header Sheet */}
            <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Nota Kasir Laundry</h3>
                  <p className="text-[11px] text-slate-500">{cartItems.length} Layanan Terpilih</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileCartSheetOpen(false)}
                className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Body */}
            <div className="flex-1 overflow-y-auto flex flex-col">
              {renderCartBody()}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky Bottom Cart Bar (< lg) */}
      <div
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 shadow-2xl flex items-center justify-between gap-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div
          onClick={() => setMobileCartSheetOpen(true)}
          className="flex-1 flex items-center gap-3 cursor-pointer min-w-0"
        >
          <div className="w-10 h-10 rounded-2xl bg-blue-900 text-white flex items-center justify-center font-black relative shrink-0 shadow-sm">
            <ShoppingCart className="w-5 h-5" />
            {cartItems.length > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-white">
                {cartItems.length}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-slate-500 font-bold truncate">
              {cartItems.length === 0 ? 'Keranjang Kosong' : `${cartTotals.totalKg > 0 ? `${cartTotals.totalKg} Kg • ` : ''}${cartTotals.totalPcs} Pcs`}
            </div>
            <div className="text-sm font-black text-blue-950 truncate">
              Rp {cartTotals.grandTotal.toLocaleString('id-ID')}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileCartSheetOpen(true)}
          className="px-4 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-black shrink-0 shadow-md shadow-blue-900/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <span>Lihat Nota</span>
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 3. Modal Konfigurasi Cucian (Timbangan / Helai / Parfum / Durasi) */}
      {modalOpen && selectedService && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-xs p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 space-y-4 max-h-[92dvh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                  {selectedService.category}
                </span>
                <h3 className="font-extrabold text-slate-900 text-sm mt-0.5">{selectedService.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddToCart} className="space-y-3.5 text-xs">
              {/* 1. Timbangan Cucian (Unit KG) */}
              {(selectedService.unit || '').toUpperCase() === 'KG' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 text-blue-900" />
                      Berat Timbangan Cucian (Kg) *
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {Number(selectedService.minOrderQty) > 1
                        ? `Batas Min: ${Number(selectedService.minOrderQty)} Kg`
                        : 'Tanpa Batas Min'}
                    </span>
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min="0.1"
                    required
                    value={itemWeightKg}
                    onChange={(e) => setItemWeightKg(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-extrabold text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900 bg-slate-50"
                  />
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {['+0.5', '+1.0', '+2.0', '+3.0', '+5.0'].map((btn) => (
                      <button
                        key={btn}
                        type="button"
                        onClick={() => {
                          const current = parseFloat(itemWeightKg) || 0;
                          const add = parseFloat(btn);
                          setItemWeightKg((current + add).toFixed(2));
                        }}
                        className="px-2 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 cursor-pointer"
                      >
                        {btn} kg
                      </button>
                    ))}
                  </div>

                  {/* Warning Box Penegakan Batas Minimal Order */}
                  {modalCalculatedPrice.isUnderMinimum && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-2 animate-fadeIn">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-extrabold block">Aturan Minimal Order Berlaku</span>
                        <span className="text-[11px] leading-relaxed">
                          Bobot cucian ({modalCalculatedPrice.actualQty.toFixed(2)} Kg) di bawah batas minimal ({modalCalculatedPrice.minQty.toFixed(2)} Kg). Pesanan dikenakan tarif minimum {modalCalculatedPrice.minQty.toFixed(2)} Kg = <b>Rp {modalCalculatedPrice.subtotal.toLocaleString('id-ID')}</b>.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : ['M2', 'M²', 'METER'].includes((selectedService.unit || '').toUpperCase()) ? (
                /* 2. Luas Dimensi (m²) untuk Karpet / Gorden */
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-blue-900" />
                      Luas Karpet / Gorden ({selectedService.unit}) *
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {Number(selectedService.minOrderQty) > 1
                        ? `Batas Min: ${Number(selectedService.minOrderQty)} ${selectedService.unit}`
                        : 'Tanpa Batas Min'}
                    </span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    value={itemWeightKg}
                    onChange={(e) => setItemWeightKg(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-extrabold text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900 bg-slate-50"
                  />
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {[
                      { val: '2.0', label: '1x2 m (2 m²)' },
                      { val: '4.0', label: '2x2 m (4 m²)' },
                      { val: '6.0', label: '2x3 m (6 m²)' },
                      { val: '8.0', label: '2x4 m (8 m²)' },
                    ].map((preset) => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => setItemWeightKg(preset.val)}
                        className="px-2 py-1 text-[11px] font-bold bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {modalCalculatedPrice.isUnderMinimum && (
                    <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-2 animate-fadeIn">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-extrabold block">Aturan Minimal Order Berlaku</span>
                        <span className="text-[11px] leading-relaxed">
                          Luas barang ({modalCalculatedPrice.actualQty.toFixed(2)} {selectedService.unit}) di bawah batas minimal ({modalCalculatedPrice.minQty.toFixed(2)} {selectedService.unit}). Dikenakan tarif minimum {modalCalculatedPrice.minQty.toFixed(2)} {selectedService.unit} = <b>Rp {modalCalculatedPrice.subtotal.toLocaleString('id-ID')}</b>.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* 3. Jumlah Potong (Pcs / Pasang / Set) jika Satuan / Sepatu */
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Jumlah ({selectedService.unit}) *
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setItemPieces(String(Math.max(1, (parseInt(itemPieces, 10) || 1) - 1)))}
                      className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-sm cursor-pointer"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      required
                      value={itemPieces}
                      onChange={(e) => setItemPieces(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-300 font-extrabold text-center text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                    <button
                      type="button"
                      onClick={() => setItemPieces(String((parseInt(itemPieces, 10) || 1) + 1))}
                      className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-sm cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Input Helai untuk Kiloan */}
              {(selectedService.unit || '').toUpperCase() === 'KG' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Estimasi Jumlah Helai Pakaian (Pcs)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={itemPieces}
                    onChange={(e) => setItemPieces(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-300 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-900"
                  />
                </div>
              )}

              {/* Aroma Parfum: Hanya tampil jika ada varian parfum aktif di toko */}
              {perfumes.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-blue-900" />
                    Pilihan Aroma Parfum Wangi
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {perfumes.map((pf) => {
                      const isSelected = itemPerfume.toLowerCase() === pf.name.toLowerCase();
                      const extra = pf.extraPrice ? Number(pf.extraPrice) : 0;
                      return (
                        <button
                          key={pf.name}
                          type="button"
                          onClick={() => setItemPerfume(pf.name)}
                          className={`px-2 py-1.5 rounded-lg text-xs font-medium border text-left transition-all cursor-pointer flex items-center justify-between gap-1 ${
                            isSelected
                              ? 'bg-blue-900 border-blue-900 text-white font-bold shadow-2xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">{pf.name}</span>
                          {extra > 0 && (
                            <span
                              className={`text-[9.5px] px-1 py-0.5 rounded font-black shrink-0 ${
                                isSelected ? 'bg-amber-400 text-blue-950' : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              +Rp {extra.toLocaleString('id-ID')}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Layanan Tambahan & Treatment Khusus (Add-ons) */}
              {availableAddons.length > 0 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                      Treatment Tambahan &amp; Add-on
                    </span>
                    {addonsCalculation.total > 0 && (
                      <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                        +Rp {addonsCalculation.total.toLocaleString('id-ID')}
                      </span>
                    )}
                  </label>
                  <div className="space-y-1.5">
                    {availableAddons.map((addon) => {
                      const isSelected = selectedAddonIds.includes(addon.id);
                      const isPerKg = ['PER_KG', 'PER_UNIT', 'KG'].includes((addon.unit || '').toUpperCase());
                      const cost = isPerKg
                        ? Math.round(Number(addon.price) * modalCalculatedPrice.billedQty)
                        : Number(addon.price);

                      return (
                        <div
                          key={addon.id}
                          onClick={() => {
                            setSelectedAddonIds((prev) =>
                              isSelected ? prev.filter((id) => id !== addon.id) : [...prev, addon.id]
                            );
                          }}
                          className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                            isSelected
                              ? 'border-purple-600 bg-purple-50/80 shadow-2xs'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="w-3.5 h-3.5 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer pointer-events-none"
                            />
                            <div>
                              <div className="text-xs font-bold text-slate-900 leading-tight">{addon.name}</div>
                              {addon.description && (
                                <div className="text-[10px] text-slate-500 leading-tight">{addon.description}</div>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0 pl-2">
                            <div className="text-xs font-black text-purple-900">
                              +Rp {cost.toLocaleString('id-ID')}
                            </div>
                            {isPerKg && (
                              <div className="text-[9px] text-slate-400">
                                (Rp {Number(addon.price).toLocaleString('id-ID')}/Kg)
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Estimasi Waktu Pengerjaan Layanan */}
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-900" />
                  Estimasi Durasi Pengerjaan:
                </span>
                <span className="font-extrabold text-xs text-blue-950 bg-white px-2 py-0.5 rounded-md border border-slate-200 shadow-2xs">
                  {selectedService.durationHours || 48} Jam
                </span>
              </div>

              {/* Catatan Khusus */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Catatan / Kondisi Pakaian
                </label>
                <div className="flex gap-1 flex-wrap mb-1.5">
                  {QUICK_NOTES.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setItemNotes((prev) => (prev ? `${prev}, ${tag}` : tag));
                      }}
                      className="px-2 py-0.5 text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-200 cursor-pointer"
                    >
                      +{tag}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  placeholder="Catatan noda, luntur, dll..."
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-blue-900"
                />
              </div>

              {/* Subtotal Item */}
              <div className="p-3 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block">Subtotal Item Ini:</span>
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-base font-black text-slate-900">
                      Rp {(modalCalculatedPrice.subtotal + addonsCalculation.total).toLocaleString('id-ID')}
                    </span>
                    {addonsCalculation.total > 0 && (
                      <span className="text-[10px] text-purple-700 font-bold">
                        (+Add-on: Rp {addonsCalculation.total.toLocaleString('id-ID')})
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-200 font-bold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambahkan</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Modal Cari Pelanggan Terdaftar (Member CRM Lookup) */}
      {customerSearchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
          <div className="w-full sm:max-w-xl bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85vh] overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-blue-100 border border-blue-200 text-blue-900 flex items-center justify-center font-bold">
                  <Search className="w-4 h-4 text-blue-900" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Cari Pelanggan Terdaftar
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Pilih pelanggan dari database CRM toko ({customersList.length} member tersimpan)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCustomerSearchModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input Bar & Quick Add Trigger */}
            <div className="p-4 border-b border-slate-100 space-y-2.5 shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Cari member terdaftar atau ketik nama pelanggan..."
                    value={memberSearchQuery}
                    onChange={(e) => setMemberSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && memberSearchQuery.trim().length >= 2) {
                        e.preventDefault();
                        handleSelectWalkIn(memberSearchQuery.trim());
                      }
                    }}
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900 font-semibold shadow-2xs"
                  />
                  {memberSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setMemberSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {memberSearchQuery.trim().length >= 2 && (
                  <button
                    type="button"
                    onClick={() => handleSelectWalkIn(memberSearchQuery.trim())}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-1 shadow-xs"
                    title="Gunakan langsung nama ini"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Gunakan &quot;{memberSearchQuery.trim()}&quot;</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setCustomerSearchModalOpen(false);
                    setQuickAddModalOpen(true);
                  }}
                  className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-800" />
                  <span>Member Baru</span>
                </button>
              </div>
            </div>

            {/* List Pelanggan Terdaftar */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-slate-100">
              {customersList
                .filter((c) => {
                  const q = memberSearchQuery.toLowerCase().trim();
                  if (!q) return true;
                  const matchName = c.name && c.name.toLowerCase().includes(q);
                  const matchPhone = c.phone && c.phone.includes(q);
                  const matchAddress = c.address && c.address.toLowerCase().includes(q);
                  return matchName || matchPhone || matchAddress;
                })
                .slice(0, 30)
                .map((cust) => {
                  const isSelected = selectedCustomerId === cust.id;
                  return (
                    <div
                      key={cust.id}
                      onClick={() => handleSelectCustomer(cust)}
                      className={`pt-2.5 first:pt-0 p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 group ${
                        isSelected
                          ? 'bg-blue-50/80 border-blue-300 shadow-xs ring-1 ring-blue-900'
                          : 'border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-xs text-slate-900 group-hover:text-blue-900">
                            {cust.name}
                          </span>
                          {cust.loyaltyTier && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                              {cust.loyaltyTier}
                            </span>
                          )}
                          {cust.totalOrders > 0 && (
                            <span className="text-[9.5px] text-slate-400 font-medium">
                              • {cust.totalOrders}x order
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-500 flex-wrap">
                          {cust.phone && (
                            <span className="flex items-center gap-1 font-semibold text-slate-700">
                              <Phone className="w-3 h-3 text-emerald-600" />
                              <span>{cust.phone}</span>
                            </span>
                          )}
                          {cust.address && (
                            <span className="flex items-center gap-1 text-slate-500 truncate max-w-xs">
                              <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate">{cust.address}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectCustomer(cust);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1 cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-600 text-white'
                            : 'bg-blue-900 hover:bg-blue-800 text-white group-hover:shadow-xs'
                        }`}
                      >
                        {isSelected ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            <span>Terpilih</span>
                          </>
                        ) : (
                          <span>Pilih</span>
                        )}
                      </button>
                    </div>
                  );
                })}

              {customersList.filter((c) => {
                const q = memberSearchQuery.toLowerCase().trim();
                if (!q) return true;
                const matchName = c.name && c.name.toLowerCase().includes(q);
                const matchPhone = c.phone && c.phone.includes(q);
                const matchAddress = c.address && c.address.toLowerCase().includes(q);
                return matchName || matchPhone || matchAddress;
              }).length === 0 && (
                <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                  <User className="w-8 h-8 mx-auto text-slate-300" />
                  <p>Tidak ada pelanggan yang cocok dengan &quot;{memberSearchQuery}&quot;</p>
                  <button
                    type="button"
                    onClick={() => {
                      setNewCustName(memberSearchQuery);
                      setCustomerSearchModalOpen(false);
                      setQuickAddModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-blue-900 text-white font-bold text-xs hover:bg-blue-800 cursor-pointer inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Daftarkan &quot;{memberSearchQuery}&quot; sebagai Pelanggan Baru</span>
                  </button>
                </div>
              )}
            </div>

            {/* Footer Modal */}
            <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span>Tekan <kbd className="px-1.5 py-0.5 rounded bg-white border border-slate-300 font-mono text-[10px]">Esc</kbd> untuk kembali</span>
              <button
                type="button"
                onClick={() => setCustomerSearchModalOpen(false)}
                className="px-3 py-1.5 rounded-xl text-slate-600 hover:bg-slate-200 font-bold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Modal Tambah Pelanggan Baru Cepat */}
      {quickAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-xs p-0 sm:p-4 animate-fadeIn">
          <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden">
            {/* Header Modal */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-emerald-100 border border-emerald-200 text-emerald-900 flex items-center justify-center font-bold">
                  <UserPlus className="w-4 h-4 text-emerald-900" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Daftarkan Pelanggan Baru
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Lengkapi identitas pelanggan &amp; alamat pengantaran untuk order laundry
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickAddModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Pendaftaran */}
            <form onSubmit={handleQuickCreateCustomer} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-5 space-y-3.5 text-xs">
                {/* Nama Pelanggan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nama Lengkap <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ibu Rina Melati / Bpk. Dimas"
                    value={newCustName}
                    onChange={(e) => setNewCustName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-900 shadow-2xs"
                  />
                </div>

                {/* Nomor WhatsApp */}
                <div>
                  <WhatsAppInput
                    label="Nomor WhatsApp Pelanggan *"
                    value={newCustPhone}
                    onChange={(val) => setNewCustPhone(val)}
                    placeholder="81234567890 (WA)"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Digunakan untuk kirim e-receipt digital dan notifikasi otomatis saat cucian selesai.
                  </p>
                </div>

                {/* Alamat Pengantaran */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-700" />
                      <span>Alamat Domisili / Pengantaran</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Sangat berguna untuk antar-jemput</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan, apartemen, atau nomor unit..."
                    value={newCustAddress}
                    onChange={(e) => setNewCustAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-blue-900 shadow-2xs resize-none"
                  />
                </div>

                {/* Patokan Lokasi */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Patokan Lokasi Khusus
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Pagar abu-abu seberang musholla, lantai 2 unit B..."
                    value={newCustLandmark}
                    onChange={(e) => setNewCustLandmark(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-medium focus:outline-none focus:ring-2 focus:ring-blue-900 shadow-2xs"
                  />
                </div>

                {/* Opsi Tambahan: Sekaligus Aktivasi Paket Deposit Saldo / Kuota Kiloan */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={activateDepositOnRegister}
                      onChange={(e) => setActivateDepositOnRegister(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-900 focus:ring-blue-900 border-slate-300"
                    />
                    <span className="font-extrabold text-blue-950 text-xs flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-emerald-600" />
                      <span>Sekaligus Aktivasi Paket Deposit Saldo / Kuota Kiloan</span>
                    </span>
                  </label>

                  {activateDepositOnRegister && (
                    <div className="mt-3 p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-3">
                      {/* Tipe Top-up: Saldo atau Kuota */}
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setRegTopupType('BALANCE');
                            setRegPricePaid(100000);
                            setRegAmount(100000);
                            setRegBonusAmount(0);
                          }}
                          className={`py-2 px-3 rounded-xl border text-left font-bold text-xs transition-all cursor-pointer ${
                            regTopupType === 'BALANCE'
                              ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <Wallet className="w-3.5 h-3.5" />
                            <span>Deposit Saldo</span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRegTopupType('QUOTA_KG');
                            setRegPricePaid(70000);
                            setRegKg(10);
                            setRegQuotaBonusKg(0);
                          }}
                          className={`py-2 px-3 rounded-xl border text-left font-bold text-xs transition-all cursor-pointer ${
                            regTopupType === 'QUOTA_KG'
                              ? 'bg-purple-900 text-white border-purple-900 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Paket Kuota (Kg)</span>
                          </div>
                        </button>
                      </div>

                      {regTopupType === 'BALANCE' ? (
                        <div className="space-y-2">
                          {depositConfig.packages.filter((p) => p.type === 'BALANCE').length > 0 && (
                            <div className="grid grid-cols-2 gap-1.5">
                              {depositConfig.packages
                                .filter((p) => p.type === 'BALANCE')
                                .map((pkg) => (
                                  <button
                                    key={pkg.id}
                                    type="button"
                                    onClick={() => {
                                      setRegPackageId(pkg.id);
                                      setRegAmount(Number(pkg.balanceAmount || pkg.price));
                                      setRegBonusAmount(Number(pkg.bonusAmount || 0));
                                      setRegPricePaid(Number(pkg.price));
                                      if (pkg.validityDays) setRegValidityDays(String(pkg.validityDays) as any);
                                    }}
                                    className={`p-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                                      regPricePaid === Number(pkg.price) && regAmount === Number(pkg.balanceAmount || pkg.price)
                                        ? 'bg-blue-900 text-white border-blue-900 font-bold'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="font-extrabold text-[11px] truncate">{pkg.name}</div>
                                    <div className="text-[10px]">Rp {Number(pkg.price).toLocaleString('id-ID')}</div>
                                  </button>
                                ))}
                            </div>
                          )}
                          <CurrencyInput
                            label="Nominal Saldo Diterima (Rp) *"
                            value={regAmount}
                            onChange={(val) => {
                              setRegAmount(val);
                              setRegPricePaid(val);
                            }}
                            min={0}
                            placeholder="100.000"
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {depositConfig.packages.filter((p) => p.type === 'QUOTA_KG').length > 0 && (
                            <div className="grid grid-cols-2 gap-1.5">
                              {depositConfig.packages
                                .filter((p) => p.type === 'QUOTA_KG')
                                .map((pkg) => (
                                  <button
                                    key={pkg.id}
                                    type="button"
                                    onClick={() => {
                                      setRegPackageId(pkg.id);
                                      setRegKg(Number(pkg.quotaKg));
                                      setRegQuotaBonusKg(Number(pkg.quotaBonusKg || 0));
                                      setRegPricePaid(Number(pkg.price));
                                      if (pkg.validityDays) setRegValidityDays(String(pkg.validityDays) as any);
                                    }}
                                    className={`p-2 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                                      regPricePaid === Number(pkg.price) && regKg === Number(pkg.quotaKg)
                                        ? 'bg-purple-900 text-white border-purple-900 font-bold'
                                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                    }`}
                                  >
                                    <div className="font-extrabold text-[11px] truncate">{pkg.name}</div>
                                    <div className="text-[10px]">{pkg.quotaKg} Kg (Rp {Number(pkg.price).toLocaleString('id-ID')})</div>
                                  </button>
                                ))}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-700 mb-1">Kuota (Kg) *</label>
                              <input
                                type="number"
                                min={1}
                                step={0.5}
                                value={regKg}
                                onChange={(e) => setRegKg(Number(e.target.value) || 0)}
                                className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 font-bold bg-white"
                              />
                            </div>
                            <CurrencyInput
                              label="Harga Beli (Rp) *"
                              value={regPricePaid}
                              onChange={(val) => setRegPricePaid(val)}
                              min={0}
                              placeholder="70.000"
                            />
                          </div>
                        </div>
                      )}

                      {/* Pilihan Metode Bayar Top-up */}
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">Metode Bayar Top-up *</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(['CASH', 'QRIS', 'TRANSFER'] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setRegPaymentMethod(m)}
                              className={`py-1.5 text-center text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                                regPaymentMethod === m
                                  ? 'bg-blue-900 text-white border-blue-900'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {m === 'CASH' ? 'Tunai' : m}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Sticky Footer Form */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setQuickAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingNewCustomer}
                  className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white font-black shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>{savingNewCustomer ? 'Menyimpan...' : 'Simpan & Pilih Pelanggan'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal Top-up Saldo & Kuota Laundry Pelanggan */}
      {topupModalOpen && selectedCustomerId && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden animate-slideUp sm:animate-zoomIn">
            {/* Modal Header */}
            <div className="p-4 sm:px-6 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-950 text-white shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Top-up Saldo &amp; Kuota Laundry
                  </h3>
                  <p className="text-[11px] text-blue-200">
                    Pelanggan: <span className="font-bold text-white">{customerName}</span> {customerPhone && `(+62${customerPhone})`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTopupModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleProcessTopup} className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4 text-xs">
                {/* Status Saldo & Kuota Saat Ini */}
                <div className="grid grid-cols-2 gap-2 p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block">Saldo Deposit Aktif</span>
                    <span className="text-sm font-black text-slate-900">
                      Rp {Number(customerWallet?.balanceAmount || 0).toLocaleString('id-ID')}
                    </span>
                    {customerWallet?.balanceExpiresAt && (
                      <span className="text-[9.5px] text-slate-400 block">
                        Kedaluwarsa: {new Date(customerWallet.balanceExpiresAt).toLocaleDateString('id-ID')}
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-bold block">Kuota Kiloan Aktif</span>
                    <span className="text-sm font-black text-purple-900">
                      {Number(customerWallet?.quotaKg || 0)} Kg
                    </span>
                    {customerWallet?.quotaExpiresAt && (
                      <span className="text-[9.5px] text-slate-400 block">
                        Kedaluwarsa: {new Date(customerWallet.quotaExpiresAt).toLocaleDateString('id-ID')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Pilih Tipe Top-up */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Jenis Pengisian
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTopupType('BALANCE')}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        topupType === 'BALANCE'
                          ? 'border-blue-900 bg-blue-50/80 ring-2 ring-blue-900/20'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-black text-blue-950 text-xs mb-0.5">
                        <Wallet className="w-4 h-4 text-blue-700" />
                        <span>Deposit Saldo</span>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Saldo rupiah fleksibel untuk seluruh layanan laundry
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTopupType('QUOTA_KG')}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        topupType === 'QUOTA_KG'
                          ? 'border-purple-900 bg-purple-50/80 ring-2 ring-purple-900/20'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 font-black text-purple-950 text-xs mb-0.5">
                        <Sparkles className="w-4 h-4 text-purple-700" />
                        <span>Paket Kuota (Kg)</span>
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Paket kuota kiloan hemat dengan masa berlaku
                      </p>
                    </button>
                  </div>
                </div>

                {/* Form Input Sesuai Jenis */}
                {topupType === 'BALANCE' ? (
                  <div className="space-y-2.5">
                    {depositConfig.packages.filter((p) => p.type === 'BALANCE').length > 0 && (
                      <div className="space-y-1.5">
                        <span className="text-[10.5px] font-bold text-slate-600 block">
                          Pilihan Paket Saldo Deposit:
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                          {depositConfig.packages
                            .filter((p) => p.type === 'BALANCE')
                            .map((pkg) => (
                              <button
                                key={pkg.id}
                                type="button"
                                onClick={() => {
                                  setTopupAmount(String(pkg.balanceAmount || pkg.price));
                                  setTopupPricePaid(String(pkg.price));
                                  setTopupBonusAmount(String(pkg.bonusAmount || 0));
                                  if (pkg.validityDays) setTopupValidityDays(String(pkg.validityDays) as any);
                                }}
                                className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                                  topupAmount === String(pkg.balanceAmount || pkg.price)
                                    ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                <div className="font-extrabold text-xs">{pkg.name}</div>
                                <div className="text-[11px] font-bold">
                                  Rp {Number(pkg.price).toLocaleString('id-ID')}
                                </div>
                                {Number(pkg.bonusAmount || 0) > 0 && (
                                  <div className={`text-[9.5px] font-bold ${topupAmount === String(pkg.balanceAmount || pkg.price) ? 'text-amber-300' : 'text-emerald-600'}`}>
                                    +Bonus Saldo Rp {Number(pkg.bonusAmount).toLocaleString('id-ID')}
                                  </div>
                                )}
                              </button>
                            ))}
                        </div>
                      </div>
                    )}

                    <CurrencyInput
                      label="Nominal Top-up Saldo (Rp) *"
                      value={topupAmount}
                      onChange={(numericVal) => {
                        setTopupAmount(String(numericVal));
                        setTopupPricePaid(String(numericVal));
                      }}
                      min={0}
                      placeholder="100.000"
                    />
                    <div className="grid grid-cols-4 gap-1.5">
                      {[50000, 100000, 200000, 500000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            setTopupAmount(String(amt));
                            setTopupPricePaid(String(amt));
                            setTopupBonusAmount('0');
                          }}
                          className={`py-1.5 px-1 rounded-xl text-[10.5px] font-bold border transition-all cursor-pointer ${
                            topupAmount === String(amt)
                              ? 'bg-blue-900 text-white border-blue-900'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          Rp {(amt / 1000).toLocaleString('id-ID')}rb
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Pilihan Paket Kuota Kiloan
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(depositConfig.packages.filter((p) => p.type === 'QUOTA_KG').length > 0
                          ? depositConfig.packages.filter((p) => p.type === 'QUOTA_KG')
                          : [
                              { id: '1', quotaKg: 5, price: 35000, name: '5 Kg' },
                              { id: '2', quotaKg: 10, price: 70000, name: '10 Kg' },
                              { id: '3', quotaKg: 20, price: 130000, name: '20 Kg' },
                              { id: '4', quotaKg: 50, price: 300000, name: '50 Kg' },
                            ]
                        ).map((pkg) => (
                          <button
                            key={pkg.id || pkg.quotaKg}
                            type="button"
                            onClick={() => {
                              setTopupKg(String(pkg.quotaKg));
                              setTopupQuotaBonusKg(String(pkg.quotaBonusKg || 0));
                              setTopupPricePaid(String(pkg.price));
                              if (pkg.validityDays) setTopupValidityDays(String(pkg.validityDays) as any);
                            }}
                            className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                              topupKg === String(pkg.quotaKg) && topupPricePaid === String(pkg.price)
                                ? 'bg-purple-900 text-white border-purple-900'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <div className="font-black text-sm flex items-center justify-between">
                              <span>{pkg.quotaKg} Kg</span>
                              {pkg.validityDays && (
                                <span className="text-[9.5px] opacity-75 font-normal">
                                  {pkg.validityDays} Hari
                                </span>
                              )}
                            </div>
                            <div className="text-[10.5px] opacity-90">Rp {Number(pkg.price).toLocaleString('id-ID')}</div>
                            {Number(pkg.quotaBonusKg || 0) > 0 && (
                              <div className={`text-[9.5px] font-bold ${topupKg === String(pkg.quotaKg) && topupPricePaid === String(pkg.price) ? 'text-amber-300' : 'text-emerald-600'}`}>
                                +Bonus {pkg.quotaBonusKg} Kg
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Jumlah Kuota (Kg)
                        </label>
                        <input
                          type="number"
                          required
                          min={1}
                          step={0.5}
                          value={topupKg}
                          onChange={(e) => setTopupKg(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 font-bold focus:outline-none focus:ring-2 focus:ring-purple-900 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Harga Dibayar Pelanggan (Rp)
                        </label>
                        <input
                          type="number"
                          required
                          min={0}
                          step={1000}
                          value={topupPricePaid}
                          onChange={(e) => setTopupPricePaid(e.target.value)}
                          className="w-full px-3 py-1.5 rounded-xl border border-slate-300 font-bold focus:outline-none focus:ring-2 focus:ring-purple-900 text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Masa Berlaku Kuota
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { val: '30', label: '30 Hari' },
                          { val: '60', label: '60 Hari' },
                          { val: '90', label: '90 Hari' },
                          { val: 'UNLIMITED', label: 'Selamanya' },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() => setTopupValidityDays(opt.val as any)}
                            className={`py-1.5 px-1 rounded-xl text-[10.5px] font-bold border transition-all cursor-pointer ${
                              topupValidityDays === opt.val
                                ? 'bg-purple-900 text-white border-purple-900'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Metode Pembayaran Top-up */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Metode Pembayaran Top-up
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { key: 'CASH', label: 'Tunai', isCash: true },
                      { key: 'QRIS', label: 'QRIS', icon: QrCode },
                      { key: 'TRANSFER', label: 'Transfer', icon: CreditCard },
                    ]
                      .filter((m) => m.key !== 'QRIS' || isQrisActive)
                      .map((m) => {
                      const Icon = (m as any).icon;
                      return (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => setTopupPaymentMethod(m.key as any)}
                          className={`py-2 px-2 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            topupPaymentMethod === m.key
                              ? 'bg-blue-900 border-blue-900 text-white shadow-xs'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          {m.isCash ? (
                            <span className="font-black text-[10px] leading-none px-1 py-0.5 rounded bg-blue-800 text-white">
                              Rp
                            </span>
                          ) : (
                            Icon && <Icon className="w-3.5 h-3.5" />
                          )}
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {topupPaymentMethod === 'CASH' && (
                    <p className="text-[10px] text-emerald-700 font-bold mt-1.5">
                      💵 Uang tunai otomatis masuk ke laci kasir shift berjalan dan menambah posisi kas drawer.
                    </p>
                  )}
                </div>
              </div>

              {/* Sticky Action Footer */}
              <div className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))] flex items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="text-[10px] text-slate-400 block font-semibold">Total Tagihan Top-up</span>
                  <span className="font-black text-slate-900 text-sm">
                    Rp {(topupType === 'BALANCE' ? Number(topupAmount) || 0 : Number(topupPricePaid) || 0).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTopupModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 font-bold cursor-pointer transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={processingTopup}
                    className="px-5 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white font-black shadow-xs flex items-center gap-1.5 cursor-pointer transition-all"
                  >
                    <span>{processingTopup ? 'Memproses...' : 'Konfirmasi Top-up'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Buka Shift (Pilar 1) */}
      <StartShiftModal
        isOpen={startShiftModalOpen}
        onClose={() => setStartShiftModalOpen(false)}
        onShiftStarted={(s) => {
          setCurrentShift(s);
          setStartShiftModalOpen(false);
          setFeedbackToast({ message: '🎉 Shift kasir berhasil dibuka!', type: 'success' });
        }}
        outletName={activeOutlet?.name}
      />

      {/* Modal Terikat Shift Aktif (Pilar 1) */}
      {currentShift && (
        <>
          {/* Modal Tutup Shift / Z-Report (Pilar 1) */}
          <CloseShiftModal
            isOpen={closeShiftModalOpen}
            onClose={() => setCloseShiftModalOpen(false)}
            onShiftClosed={() => {
              setCurrentShift(null);
              setCloseShiftModalOpen(false);
              setFeedbackToast({ message: '✅ Shift kasir berhasil ditutup!', type: 'success' });
              if (onLogout && currentUser?.role === 'CASHIER') {
                setTimeout(() => onLogout(), 1500);
              }
            }}
            currentShift={currentShift}
          />

          {/* Modal X-Report Laporan Berjalan Shift (Pilar 1) */}
          <XReportModal
            isOpen={xReportModalOpen}
            onClose={() => setXReportModalOpen(false)}
          />

          {/* Modal Kas Keluar / Kas Masuk Operasional (Pilar 1) */}
          <CashExpenseModal
            isOpen={cashExpenseModalOpen}
            onClose={() => setCashExpenseModalOpen(false)}
            onExpenseRecorded={() => {
              loadCurrentShift();
              setFeedbackToast({ message: '✅ Mutasi kas drawer berhasil dicatat!', type: 'success' });
            }}
            currentShift={currentShift}
          />
        </>
      )}

      {/* Modal Pemilihan Voucher Promo (Pilar 2) */}
      <VoucherSelectionModal
        isOpen={voucherModalOpen}
        onClose={() => setVoucherModalOpen(false)}
        subtotal={cartTotals.subtotal}
        appliedPromotion={appliedPromotion}
        onApplyPromotion={(promo) => {
          setAppliedPromotion(promo);
          setVoucherModalOpen(false);
          setFeedbackToast({ message: `🎟️ Voucher "${promo.name}" berhasil diterapkan!`, type: 'success' });
        }}
        onRemovePromotion={() => {
          setAppliedPromotion(null);
          setVoucherModalOpen(false);
        }}
      />

      {/* Modal Absensi Staf Kasir (Pilar 4) */}
      <StaffAttendanceModal
        isOpen={staffAttendanceModalOpen}
        onClose={() => setStaffAttendanceModalOpen(false)}
        activeOutlet={activeOutlet}
      />

      {/* 6. Modal Struk Thermal Laundry Penerimaan */}
      <LaundryReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        order={completedOrder}
        outlet={activeOutlet}
      />

      {/* 7. Modal Preferensi & Nomor Alternatif Pelanggan (Core Phase 1) */}
      {prefModalOpen && selectedCustomerId && (
        <CustomerPreferenceModal
          isOpen={prefModalOpen}
          onClose={() => setPrefModalOpen(false)}
          customerId={selectedCustomerId}
          customerName={customerName}
          customerPhone={customerPhone}
          onSaved={(updated) => {
            if (selectedCustomer) {
              setSelectedCustomer((prev: any) => ({
                ...prev,
                laundryPreferences: updated.laundryPreferences,
                secondaryPhones: updated.secondaryPhones,
              }));
            }
          }}
        />
      )}

      {/* Floating Feedback Toast */}
      {feedbackToast && (
        <div
          className={`fixed bottom-24 lg:bottom-6 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold animate-fadeIn transition-all ${
            feedbackToast.type === 'success'
              ? 'bg-emerald-950 text-emerald-100 border-emerald-700'
              : 'bg-rose-950 text-rose-100 border-rose-700'
          }`}
        >
          {feedbackToast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{feedbackToast.message}</span>
        </div>
      )}
    </div>
  );
};
