import React, { useState, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import type { Outlet } from '../types/outlet';
import type { LaundryService, LaundryQueueOrder, CustomerLaundryWallet } from '../types/laundry';
import { api, customerApi } from '../services/api';
import { WhatsAppInput } from '../components/ui';
import { LaundryReceiptModal } from '../components/laundry/LaundryReceiptModal';
import { generateIdempotencyKey } from '../utils/offlineQueue';

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

const PERFUME_OPTIONS = [
  'Lavender',
  'Ocean Fresh',
  'Akasia',
  'Snappy',
  'Sakura',
  'Downy Black',
  'Tanpa Parfum',
];

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
}) => {
  const [services, setServices] = useState<LaundryService[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Pelanggan & CRM
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customersList, setCustomersList] = useState<any[]>([]);

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
  const [processingTopup, setProcessingTopup] = useState(false);

  // Diskon / Kupon Promo
  const [showDiscountInput, setShowDiscountInput] = useState(false);
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('FIXED');
  const [discountValue, setDiscountValue] = useState('0');

  // Transaksi Processing & Modal Struk
  const [processingOrder, setProcessingOrder] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<LaundryQueueOrder | null>(null);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Ambil daftar layanan dari API
  const fetchServices = async () => {
    try {
      setLoadingServices(true);
      const res = await api.getLaundryServices();
      if (res.status === 'success' && Array.isArray(res.data)) {
        setServices(res.data);
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
      }
    } catch {
      // Abaikan jika CRM error
    }
  };

  useEffect(() => {
    fetchServices();
    fetchCustomers();
  }, [activeOutlet?.id]);

  const handleSelectCustomer = (cust: any) => {
    setCustomerName(cust.name || '');
    setCustomerPhone(cust.phone ? cust.phone.replace(/^\+?62/, '') : '');
    setSelectedCustomerId(cust.id);
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
    setCustomerWallet(null);
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
        setQuickAddModalOpen(false);
        setNewCustName('');
        setNewCustPhone('');
        setNewCustAddress('');
        setNewCustLandmark('');
        setFeedbackToast({
          message: `🎉 Pelanggan baru "${created.name}" berhasil didaftarkan & dipilih!`,
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
  const handleProcessTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || !activeOutlet) {
      alert('Pelanggan dan outlet aktif wajib tersedia');
      return;
    }
    setProcessingTopup(true);
    try {
      let expiresAt: string | undefined = undefined;
      if (topupType === 'QUOTA_KG' && topupValidityDays !== 'UNLIMITED') {
        const d = new Date();
        d.setDate(d.getDate() + Number(topupValidityDays));
        expiresAt = d.toISOString();
      }

      const res = await api.topupCustomerLaundryWallet(selectedCustomerId, {
        type: topupType,
        amount: topupType === 'BALANCE' ? Number(topupAmount) : undefined,
        kg: topupType === 'QUOTA_KG' ? Number(topupKg) : undefined,
        pricePaid: topupType === 'QUOTA_KG' ? Number(topupPricePaid) : Number(topupAmount),
        paymentMethod: topupPaymentMethod,
        outletId: activeOutlet.id,
        quotaExpiresAt: expiresAt,
        notes: `Top-up kasir ${activeOutlet.name}`,
      });

      if (res.status === 'success') {
        // Refresh wallet
        const walletRes = await api.getCustomerLaundryWallet(selectedCustomerId);
        if (walletRes.status === 'success' && walletRes.data) {
          setCustomerWallet(walletRes.data);
        }
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
    setSelectedService(srv);
    const unitUpper = (srv.unit || '').toUpperCase();
    const isWeightOrArea = ['KG', 'M2', 'M²', 'METER'].includes(unitUpper);
    const rawMin = Number(srv.minOrderQty);
    const hasMinRule = rawMin > 1;
    setItemWeightKg(hasMinRule ? String(rawMin) : isWeightOrArea ? '3.0' : '1.0');
    setItemPieces(unitUpper === 'KG' ? '10' : '1');
    setItemPerfume('Lavender');
    setItemNotes('');
    setSelectedAddonIds([]);
    setModalOpen(true);
  };

  // Klik kartu layanan: jika pelanggan belum diisi, buka modal input pelanggan terlebih dahulu
  const handleSelectService = (srv: LaundryService) => {
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
    return { total, items };
  }, [selectedAddonIds, availableAddons, modalCalculatedPrice.billedQty]);

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

    const numDisc = parseFloat(discountValue.replace(/[^0-9]/g, '')) || 0;
    const calculatedDiscount =
      discountType === 'PERCENT'
        ? Math.round((subtotal * Math.min(100, numDisc)) / 100)
        : Math.min(subtotal, numDisc);

    const grandTotal = Math.max(0, subtotal - calculatedDiscount);

    return {
      subtotal,
      deliveryFee: 0,
      discountAmount: calculatedDiscount,
      grandTotal,
      totalKg: Number(totalKg.toFixed(2)),
      totalPcs,
      maxHours,
      readyDate,
    };
  }, [cartItems, discountType, discountValue]);

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
  };

  // Listener Shortcut Keyboard Kasir (F1: Transaksi Baru, F2: Cari Member / Selesaikan Transaksi, Esc: Tutup Modal)
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
      } else if (e.key === 'Escape') {
        if (customerSearchModalOpen) setCustomerSearchModalOpen(false);
        else if (quickAddModalOpen) setQuickAddModalOpen(false);
        else if (modalOpen) setModalOpen(false);
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

    setProcessingOrder(true);
    try {
      const fullNotes = cartItems.map((i) => i.notes).filter(Boolean).join('; ');

      const payload = {
        outletId: activeOutlet.id,
        customerId: selectedCustomerId || undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone ? `+62${customerPhone.replace(/^0+/, '')}` : undefined,
        deliveryType: 'SELF_PICKUP',
        deliveryDistanceKm: 0,
        deliveryFeePerKm: 0,
        deliveryFee: 0,
        items: cartItems.map((item) => ({
          serviceId: item.serviceId,
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
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
        paymentMethod: paymentChoice === 'UNPAID' ? 'UNPAID' : paymentMethod,
        customerNotes: fullNotes || undefined,
      };

      const clientUuid = generateIdempotencyKey();
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
          customerAddress: null,
          deliveryType: 'SELF_PICKUP',
          deliveryDistanceKm: 0,
          deliveryFee: 0,
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

        // Reset keranjang untuk transaksi berikutnya
        setCartItems([]);
        handleResetCustomer();
        setCashReceived('');
        setDepositAmount('0');
        setPaymentChoice('PAID');
        setDiscountValue('0');
        setShowDiscountInput(false);

        // Refresh CRM list
        fetchCustomers();

        setFeedbackToast({
          message: `Nota ${newQueueOrder.invoiceNumber} berhasil dicatat & masuk antrean!`,
          type: 'success',
        });
        setTimeout(() => setFeedbackToast(null), 4000);
      } else {
        alert(res.message || 'Gagal memproses transaksi laundry');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem saat memproses transaksi');
    } finally {
      setProcessingOrder(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-68px)] bg-slate-100 font-sans text-slate-800">
      {/* 1. Header Toolbar Terminal Kasir Laundry */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-xs shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold shadow-xs">
            <Shirt className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold text-slate-900">
                Kasir Laundry &amp; Cuci Kiloan
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                SmartKasir Mode
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {activeOutlet?.name || 'Toko Aktif'} • Kasir: <span className="font-semibold text-slate-700">{currentUser?.name}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Tombol Transaksi Baru F1 */}
          <button
            type="button"
            onClick={handleNewTransaction}
            className="px-3 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
            title="Mulai Transaksi Baru (F1)"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            <span>+ Transaksi Baru (F1)</span>
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
            <span>Surat Jalan</span>
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

      {/* Banner Non-intrusif Status Jaringan Offline */}
      {!isOnline && (
        <div className="bg-amber-50 border-b border-amber-300 px-4 py-2 flex items-center justify-between text-xs text-amber-900 shrink-0">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
            <span className="font-extrabold">Mode Offline Terdeteksi:</span>
            <span>Koneksi internet terputus. Pastikan internet terhubung kembali untuk sinkronisasi data operasional.</span>
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
          <div className="flex-1 p-3 overflow-y-auto">
            {/* Customer-First Guardrail Banner */}
            {!isCustomerFilled && (
              <div className="mb-3.5 p-3 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300/80 shadow-xs flex items-center justify-between gap-3 animate-fadeIn">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 flex items-center justify-center shrink-0">
                    <Lock className="w-4 h-4 text-amber-900" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                        Input Pelanggan
                      </span>
                      <h4 className="text-xs font-black text-amber-950">
                        Tentukan Nama Pelanggan Sebelum Memilih Layanan
                      </h4>
                    </div>
                    <p className="text-[11px] text-amber-900/90 mt-0.5">
                      Klik salah satu layanan di bawah atau tombol berikut untuk menentukan nama pelanggan.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setCustomerSearchModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-extrabold text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
                  >
                    <Search className="w-3.5 h-3.5" />
                    <span>Cari Pelanggan (F2)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickAddModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 font-extrabold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Baru</span>
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

        {/* Kolom Kanan: Kasir Nota & Pembayaran (1/3 Layar) */}
        <section className="w-full lg:w-[420px] xl:w-[460px] bg-slate-50 border-l border-slate-200 flex flex-col overflow-hidden shrink-0">
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
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {isCustomerFilled
                    ? customerPhone
                      ? `+62 ${customerPhone.replace(/^\+?62/, '')}`
                      : 'Tanpa No. WhatsApp'
                    : 'Klik layanan untuk input nama'}
                </div>
                {selectedCustomerId && (
                  <div className="flex items-center gap-1.5 flex-wrap mt-1">
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
                      </>
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
                  ].map((m) => {
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

            {/* Diskon / Kupon Promo Input Toggle */}
            <div className="pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowDiscountInput(!showDiscountInput)}
                  className="text-[11px] font-bold text-blue-900 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <Tag className="w-3 h-3" />
                  <span>{showDiscountInput ? 'Sembunyikan Diskon' : '+ Tambah Diskon / Promo'}</span>
                </button>
                {cartTotals.discountAmount > 0 && (
                  <span className="text-xs font-bold text-rose-600">
                    -Rp {cartTotals.discountAmount.toLocaleString('id-ID')}
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
              {cartTotals.discountAmount > 0 && (
                <div className="flex items-center justify-between text-xs text-rose-600 font-bold">
                  <span>Diskon Promo:</span>
                  <span>-Rp {cartTotals.discountAmount.toLocaleString('id-ID')}</span>
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
        </section>
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

              {/* Aroma Parfum */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-blue-900" />
                  Pilihan Aroma Parfum Wangi
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {PERFUME_OPTIONS.map((pf) => (
                    <button
                      key={pf}
                      type="button"
                      onClick={() => setItemPerfume(pf)}
                      className={`px-2 py-1.5 rounded-lg text-xs font-medium border text-left transition-all cursor-pointer ${
                        itemPerfume === pf
                          ? 'bg-blue-900 border-blue-900 text-white font-bold shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {pf}
                    </button>
                  ))}
                </div>
              </div>

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
                  <span>+ Member Baru</span>
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
                    <label className="block text-xs font-bold text-slate-700">
                      Nominal Top-up Saldo (Rp)
                    </label>
                    <input
                      type="number"
                      required
                      min={1000}
                      step={1000}
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-900 shadow-2xs"
                    />
                    <div className="grid grid-cols-4 gap-1.5">
                      {[50000, 100000, 200000, 500000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setTopupAmount(String(amt))}
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
                        {[
                          { kg: 5, price: 35000, label: '5 Kg - Rp 35rb' },
                          { kg: 10, price: 70000, label: '10 Kg - Rp 70rb' },
                          { kg: 20, price: 130000, label: '20 Kg - Rp 130rb' },
                          { kg: 50, price: 300000, label: '50 Kg - Rp 300rb' },
                        ].map((pkg) => (
                          <button
                            key={pkg.kg}
                            type="button"
                            onClick={() => {
                              setTopupKg(String(pkg.kg));
                              setTopupPricePaid(String(pkg.price));
                            }}
                            className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                              topupKg === String(pkg.kg) && topupPricePaid === String(pkg.price)
                                ? 'bg-purple-900 text-white border-purple-900'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <div className="font-black text-sm">{pkg.kg} Kg</div>
                            <div className="text-[10.5px] opacity-90">Rp {pkg.price.toLocaleString('id-ID')}</div>
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
                    ].map((m) => {
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

      {/* 6. Modal Struk Thermal Laundry Penerimaan */}
      <LaundryReceiptModal
        isOpen={receiptModalOpen}
        onClose={() => setReceiptModalOpen(false)}
        order={completedOrder}
        outlet={activeOutlet}
      />

      {/* Floating Feedback Toast */}
      {feedbackToast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold animate-fadeIn transition-all ${
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
