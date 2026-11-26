import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Shirt,
  Scale,
  Plus,
  Minus,
  Sparkles,
  Clock,
  Check,
  User,
  Search,
  ExternalLink,
  Tag,
  CreditCard,
  Banknote,
  QrCode,
  AlertCircle,
  Loader2,
  Truck,
  ChevronDown,
  Wallet,
} from 'lucide-react';
import type { Outlet } from '../../types/outlet';
import type {
  LaundryService,
  LaundryQueueOrder,
  CustomerLaundryWallet,
  LaundryDeliveryConfig,
  LaundryDeliveryType,
  LaundryPerfume,
} from '../../types/laundry';
import { api, customerApi } from '../../services/api';
import { WhatsAppInput, CurrencyInput } from '../ui';
import { generateIdempotencyKey, saveOfflineOrder } from '../../utils/offlineQueue';
import { getOfflineCache, setOfflineCache } from '../../utils/offlineDataCache';
import { StartShiftModal } from '../StartShiftModal';
import type { Shift } from '../../types/shift';

interface LaundryQuickDropoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOutlet: Outlet | null;
  currentUser: any;
  onOrderCreated: (order: LaundryQueueOrder) => void;
  onOpenFullPos?: () => void;
}

const QUICK_SPOT_NOTES = [
  'Pisahkan Putih',
  'Noda di Kerah',
  'Bahan Sutra / Sensitif',
  'Kelunturan',
  'Kancing Copot',
];

export const LaundryQuickDropoffModal: React.FC<LaundryQuickDropoffModalProps> = ({
  isOpen,
  onClose,
  activeOutlet,
  currentUser,
  onOrderCreated,
  onOpenFullPos,
}) => {
  // Services & Categories
  const [services, setServices] = useState<LaundryService[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [serviceSearch, setServiceSearch] = useState<string>('');

  // Customer Management
  const [customerSearch, setCustomerSearch] = useState('');
  const [customersList, setCustomersList] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerWallet, setCustomerWallet] = useState<CustomerLaundryWallet | null>(null);
  const [loadingWallet, setLoadingWallet] = useState(false);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerInputRef = React.useRef<HTMLInputElement | null>(null);

  // Order Details
  const [weightKg, setWeightKg] = useState<number>(3.0);
  const [totalPieces, setTotalPieces] = useState<number>(8);
  const [perfumeVariant, setPerfumeVariant] = useState<string>('Lavender');
  const [perfumesList, setPerfumesList] = useState<LaundryPerfume[]>([]);
  const [selectedSpotNotes, setSelectedSpotNotes] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState('');

  // Payment Options
  const [paymentChoice, setPaymentChoice] = useState<'PAID' | 'UNPAID' | 'PARTIAL'>('PAID');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'TRANSFER' | 'CUSTOMER_DEPOSIT' | 'LAUNDRY_QUOTA'>('CASH');
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // QRIS Config Toko (Pilar 1 - Gelombang 2)
  const qrisConfig = activeOutlet?.paymentConfig?.qris;
  const isQrisActive = qrisConfig ? qrisConfig.isActive !== false : true;
  const qrisImageUrl = qrisConfig?.imageUrl || null;

  useEffect(() => {
    if (!isQrisActive && paymentMethod === 'QRIS') {
      setPaymentMethod('CASH');
    }
  }, [isQrisActive, paymentMethod]);

  // Shift Kasir State
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [startShiftModalOpen, setStartShiftModalOpen] = useState(false);

  // Delivery & Antar-Jemput
  const [deliveryConfig, setDeliveryConfig] = useState<LaundryDeliveryConfig | null>(null);
  const [deliveryType, setDeliveryType] = useState<LaundryDeliveryType>('NONE');
  const [deliveryZoneId, setDeliveryZoneId] = useState<string>('');
  const [deliveryAddress, setDeliveryAddress] = useState<string>('');
  const [deliveryNotes, setDeliveryNotes] = useState<string>('');

  // Helper Format Satuan Unit Ramah Pengguna
  const formatServiceUnit = (unit?: string) => {
    if (!unit) return '/Kg';
    const u = unit.toUpperCase().trim();
    if (u === 'PER_KG' || u === 'KG') return '/Kg';
    if (u === 'PER_PCS' || u === 'PCS' || u === 'PIECE') return '/Pcs';
    if (u === 'FLAT' || u === 'ITEM') return '/Item';
    if (u === 'PACKAGE' || u === 'PAKET') return '/Paket';
    if (u === 'METER' || u === 'M2') return '/m²';
    return `/${unit}`;
  };

  // Fetch Services & Initial Customers & Shift when modal opens (Network-First, Fallback-to-Cache)
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setLoadingServices(true);
    setErrorMsg(null);

    const catalogKey = `laundry_catalog:${activeOutlet?.id || 'default'}`;
    const custKey = `customers:${currentUser?.tenantId || currentUser?.id || 'default'}`;
    const shiftKey = `current_shift:${currentUser?.id || 'default'}:${activeOutlet?.id || 'default'}`;

    const applyServicesList = (srvList: LaundryService[]) => {
      setServices(srvList);
      const nonAddons = srvList.filter(
        (s: LaundryService) => s.category !== 'ADDON' && s.isActive !== false
      );
      const firstKiloan = nonAddons.find((s: LaundryService) => s.category === 'KILOAN');
      const def = firstKiloan || nonAddons[0] || srvList[0];
      if (def) {
        setSelectedServiceId(def.id);
        if (def.minOrderQty) {
          setWeightKg(Math.max(3.0, Number(def.minOrderQty)));
        }
      }
    };

    const restoreShiftFromCache = async () => {
      const cached = await getOfflineCache<Shift | null>(shiftKey);
      if (!mounted) return;
      if (cached && 'data' in cached && cached.data) {
        setCurrentShift(cached.data);
      }
    };

    // Cek shift kasir aktif
    api.getCurrentShift()
      .then(async (res) => {
        if (!mounted) return;
        if (res.status === 'success') {
          setCurrentShift(res.data);
          setOfflineCache(shiftKey, res.data);
        } else if ((res as any)?.offline === true || (typeof navigator !== 'undefined' && !navigator.onLine)) {
          await restoreShiftFromCache();
        } else {
          setCurrentShift(null);
        }
      })
      .catch(async () => {
        await restoreShiftFromCache();
      });

    Promise.all([
      api.getLaundryServices(activeOutlet?.id).catch(() => ({ status: 'error', data: [] })),
      customerApi.getCustomers({ limit: 50 }).catch(() => ({ status: 'error', data: [] })),
      activeOutlet?.id
        ? api.getLaundryDeliveryConfig(activeOutlet.id).catch(() => ({ status: 'error', data: null }))
        : Promise.resolve({ status: 'error', data: null }),
      api.getLaundryPerfumes().catch(() => ({ status: 'error', data: [] })),
    ]).then(async ([srvRes, custRes, delRes, perfRes]) => {
      if (!mounted) return;

      const resolvedDeliveryConfig =
        delRes?.status === 'success' && delRes.data ? delRes.data : null;

      if (srvRes?.status === 'success' && Array.isArray(srvRes.data)) {
        const availableServices = srvRes.data.filter(
          (s: any) => s.isAvailableAtOutlet !== false
        );
        applyServicesList(availableServices);
        if (resolvedDeliveryConfig) {
          setDeliveryConfig(resolvedDeliveryConfig);
          if (resolvedDeliveryConfig.zones && resolvedDeliveryConfig.zones.length > 0) {
            setDeliveryZoneId(resolvedDeliveryConfig.zones[0].id);
          }
        }
        setOfflineCache(catalogKey, {
          services: availableServices,
          deliveryConfig: resolvedDeliveryConfig,
        });
      } else {
        const cachedCatalog = await getOfflineCache<{
          services: LaundryService[];
          deliveryConfig: LaundryDeliveryConfig | null;
        }>(catalogKey);
        if (!mounted) return;
        if (cachedCatalog?.data) {
          if (Array.isArray(cachedCatalog.data.services)) {
            applyServicesList(cachedCatalog.data.services);
          }
          if (cachedCatalog.data.deliveryConfig) {
            setDeliveryConfig(cachedCatalog.data.deliveryConfig);
            if (
              cachedCatalog.data.deliveryConfig.zones &&
              cachedCatalog.data.deliveryConfig.zones.length > 0
            ) {
              setDeliveryZoneId(cachedCatalog.data.deliveryConfig.zones[0].id);
            }
          }
        }
      }

      if (custRes?.status === 'success' && Array.isArray(custRes.data)) {
        setCustomersList(custRes.data);
        setOfflineCache(custKey, custRes.data);
      } else {
        const cachedCustomers = await getOfflineCache<any[]>(custKey);
        if (!mounted) return;
        if (cachedCustomers?.data && Array.isArray(cachedCustomers.data)) {
          setCustomersList(cachedCustomers.data);
        }
      }

      if (delRes?.status === 'success' && delRes.data && srvRes?.status !== 'success') {
        setDeliveryConfig(delRes.data);
        if (delRes.data.zones && delRes.data.zones.length > 0) {
          setDeliveryZoneId(delRes.data.zones[0].id);
        }
      }

      if (perfRes?.status === 'success' && Array.isArray(perfRes.data) && perfRes.data.length > 0) {
        setPerfumesList(perfRes.data);
        const defPerfume = perfRes.data.find((p: LaundryPerfume) => p.isDefault) || perfRes.data[0];
        if (defPerfume) {
          setPerfumeVariant(defPerfume.name);
        }
      } else {
        setPerfumesList([]);
        setPerfumeVariant('Standard');
      }
      if (mounted) setLoadingServices(false);
    });

    return () => {
      mounted = false;
    };
  }, [isOpen, activeOutlet?.id, currentUser?.id, currentUser?.tenantId]);

  // Selected Service Object
  const currentService = useMemo(() => {
    return services.find((s) => s.id === selectedServiceId) || null;
  }, [services, selectedServiceId]);

  // Categories & Search Filter (Kecualikan ADDON dari Layanan Utama & Sortir KILOAN Teratas)
  const filteredServices = useMemo(() => {
    // 1. Filter out ADDON category from primary service list
    let list = services.filter((s) => s.category !== 'ADDON' && s.isActive !== false);

    // 2. Filter by category tab
    if (activeCategory !== 'ALL') {
      list = list.filter((s) => s.category === activeCategory);
    } else {
      // Sort KILOAN to the top when tab 'Semua' is active
      list = [...list].sort((a, b) => {
        if (a.category === 'KILOAN' && b.category !== 'KILOAN') return -1;
        if (a.category !== 'KILOAN' && b.category === 'KILOAN') return 1;
        return 0;
      });
    }

    // 3. Search query filter
    if (serviceSearch.trim()) {
      const q = serviceSearch.toLowerCase().trim();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }

    return list;
  }, [services, activeCategory, serviceSearch]);

  // Filtered Customers Auto-complete
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim() || selectedCustomer) return [];
    const q = customerSearch.toLowerCase();
    return customersList
      .filter((c) => c.name?.toLowerCase().includes(q) || c.phone?.includes(q))
      .slice(0, 5);
  }, [customerSearch, customersList, selectedCustomer]);

  // Handle Customer Selection
  const handleSelectCustomer = async (cust: any) => {
    setSelectedCustomer(cust);
    setCustomerName(cust.name || '');
    setCustomerPhone(cust.phone ? `+62${cust.phone.replace(/^(\+62|0)/, '')}` : '');
    setCustomerSearch(cust.name || '');
    if (cust.address && !deliveryAddress) {
      setDeliveryAddress(cust.address);
    }
    setShowCustomerDropdown(false);

    // Fetch customer wallet / quota if available
    try {
      setLoadingWallet(true);
      const res = await api.getCustomerLaundryWallet(cust.id);
      if (res.status === 'success' && res.data) {
        setCustomerWallet(res.data);
      } else {
        setCustomerWallet(null);
      }
    } catch {
      setCustomerWallet(null);
    } finally {
      setLoadingWallet(false);
    }
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerSearch('');
    setCustomerWallet(null);
    setDeliveryAddress('');
    setDeliveryNotes('');
    setDeliveryType('NONE');
    if (paymentMethod === 'CUSTOMER_DEPOSIT' || paymentMethod === 'LAUNDRY_QUOTA') {
      setPaymentMethod('CASH');
    }
  };

  // Toggle Spotting Notes
  const handleToggleSpotNote = (note: string) => {
    setSelectedSpotNotes((prev) =>
      prev.includes(note) ? prev.filter((n) => n !== note) : [...prev, note]
    );
  };

  // Stepper Handlers for Weight
  const handleWeightDelta = (delta: number) => {
    setWeightKg((prev) => {
      const next = Math.max(0.5, Math.round((prev + delta) * 10) / 10);
      return next;
    });
  };

  // Stepper Handlers for Pieces
  const handlePiecesDelta = (delta: number) => {
    setTotalPieces((prev) => Math.max(1, prev + delta));
  };

  // Calculate Subtotal & Billed Quantity & Delivery Fee
  const { billedQty, isUnderMinimum, minOrderQty, subtotal, deliveryFee, isFreeDelivery, grandTotal } = useMemo(() => {
    if (!currentService) {
      return {
        billedQty: 0,
        isUnderMinimum: false,
        minOrderQty: 0,
        subtotal: 0,
        deliveryFee: 0,
        isFreeDelivery: false,
        grandTotal: 0,
      };
    }

    const minQty = Number(currentService.minOrderQty) || 0;
    const isKiloan = currentService.category === 'KILOAN' || currentService.unit.toLowerCase() === 'kg';
    const underMin = isKiloan && minQty > 0 && weightKg < minQty;
    const billed = isKiloan ? (underMin ? minQty : weightKg) : weightKg;
    const total = billed * Number(currentService.price);

    const selectedPerfume = perfumesList.find((p) => p.name.toLowerCase() === perfumeVariant.toLowerCase());
    let perfumeExtra = 0;
    if (selectedPerfume && Number(selectedPerfume.extraPrice) > 0) {
      const extra = Number(selectedPerfume.extraPrice);
      perfumeExtra = selectedPerfume.usageBasis === 'PER_KG' ? Math.round(extra * billed) : extra;
    }
    const finalSubtotal = total + perfumeExtra;

    let effectiveFee = 0;
    let free = false;

    if (deliveryType !== 'NONE') {
      const zones = deliveryConfig?.zones || [];
      const selectedZone = zones.find((z) => z.id === deliveryZoneId) || zones[0];
      const baseFee = selectedZone ? Number(selectedZone.fee) : 10000;
      const multiplier = deliveryType === 'PICKUP_AND_DELIVERY' ? (deliveryConfig?.roundTripMultiplier || 1.8) : 1;
      const calculatedFee = Math.round(baseFee * multiplier);

      if (deliveryConfig?.freeDeliveryMinAmount && finalSubtotal >= Number(deliveryConfig.freeDeliveryMinAmount)) {
        free = true;
        effectiveFee = 0;
      } else if (deliveryConfig?.freeDeliveryMinWeightKg && weightKg >= Number(deliveryConfig.freeDeliveryMinWeightKg)) {
        free = true;
        effectiveFee = 0;
      } else {
        effectiveFee = calculatedFee;
      }
    }

    return {
      billedQty: billed,
      isUnderMinimum: underMin,
      minOrderQty: minQty,
      subtotal: finalSubtotal,
      deliveryFee: effectiveFee,
      isFreeDelivery: free,
      grandTotal: finalSubtotal + effectiveFee,
    };
  }, [currentService, weightKg, deliveryType, deliveryZoneId, deliveryConfig, perfumeVariant, perfumesList]);

  // Submission Handler
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift) {
      setErrorMsg('Shift kasir belum dibuka. Buka shift terlebih dahulu agar pencatatan kas laci akurat.');
      setStartShiftModalOpen(true);
      return;
    }
    if (!customerName.trim()) {
      setErrorMsg('Nama pelanggan wajib diisi untuk menyimpan pesanan');
      customerInputRef.current?.focus();
      return;
    }
    if (!currentService) {
      setErrorMsg('Pilih minimal satu layanan laundry');
      return;
    }
    if (!activeOutlet?.id) {
      setErrorMsg('Toko / Outlet aktif tidak ditemukan');
      return;
    }
    if (paymentChoice === 'PARTIAL' && Number(depositAmount) <= 0) {
      setErrorMsg('Masukkan nominal uang muka (DP) yang valid');
      return;
    }
    if (paymentChoice !== 'UNPAID' && paymentMethod === 'CUSTOMER_DEPOSIT') {
      const targetPay = paymentChoice === 'PAID' ? grandTotal : depositAmount;
      if (Number(customerWallet?.balanceAmount || 0) < targetPay) {
        setErrorMsg(`Saldo deposit pelanggan tidak mencukupi (Tersedia: Rp ${Number(customerWallet?.balanceAmount || 0).toLocaleString('id-ID')})`);
        return;
      }
    }
    if (paymentChoice !== 'UNPAID' && paymentMethod === 'LAUNDRY_QUOTA') {
      const requiredKg = weightKg > 0 ? weightKg : 1;
      if (Number(customerWallet?.quotaKg || 0) < requiredKg) {
        setErrorMsg(`Kuota kiloan pelanggan tidak mencukupi bobot cucian (Tersedia: ${Number(customerWallet?.quotaKg || 0)} Kg, Dibutuhkan: ${requiredKg} Kg)`);
        return;
      }
    }

    const isDigitalOrWallet =
      paymentChoice !== 'UNPAID' &&
      ['QRIS', 'TRANSFER', 'CUSTOMER_DEPOSIT', 'LAUNDRY_QUOTA'].includes(paymentMethod);

    if (!navigator.onLine && isDigitalOrWallet) {
      setErrorMsg(
        'Pembayaran digital atau saldo deposit / kuota membutuhkan koneksi internet aktif. Gunakan metode Tunai atau Bayar Nanti saat offline.'
      );
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);
    const clientUuid = generateIdempotencyKey();

    const allNotesArray = [...selectedSpotNotes];
    if (customNotes.trim()) allNotesArray.push(customNotes.trim());
    const compiledNotes = allNotesArray.join('; ');

    const formattedPhone = customerPhone
      ? customerPhone.startsWith('+62')
        ? customerPhone
        : `+62${customerPhone.replace(/^0+/, '')}`
      : undefined;

    const zones = deliveryConfig?.zones || [];
    const selectedZone = zones.find((z) => z.id === deliveryZoneId) || zones[0];

    const selectedPerfume = perfumesList.find((p) => p.name.toLowerCase() === perfumeVariant.toLowerCase());
    const perfumeExtra = (selectedPerfume && Number(selectedPerfume.extraPrice) > 0)
      ? (selectedPerfume.usageBasis === 'PER_KG' ? Math.round(Number(selectedPerfume.extraPrice) * billedQty) : Number(selectedPerfume.extraPrice))
      : 0;

    const addons: any[] = [];
    if (perfumeExtra > 0 && selectedPerfume) {
      addons.push({
        id: selectedPerfume.id,
        name: `Parfum: ${selectedPerfume.name}`,
        price: Number(selectedPerfume.extraPrice),
        unit: selectedPerfume.usageBasis === 'PER_KG' ? 'PER_KG' : 'FLAT',
        total: perfumeExtra,
      });
    }

    const payload = {
      outletId: activeOutlet.id,
      customerId: selectedCustomer?.id || undefined,
      customerName: customerName.trim(),
      customerPhone: formattedPhone,
      deliveryType: deliveryType,
      deliveryDistanceKm: 0,
      deliveryFeePerKm: 0,
      deliveryFee: deliveryFee,
      deliveryZoneName: deliveryType !== 'NONE' ? selectedZone?.name : undefined,
      deliveryAddress: deliveryType !== 'NONE' ? deliveryAddress.trim() : undefined,
      deliveryNotes: deliveryType !== 'NONE' ? deliveryNotes.trim() : undefined,
      items: [
        {
          serviceId: currentService.id,
          name: currentService.name,
          category: currentService.category,
          quantity: Number(billedQty),
          unit: currentService.unit || 'Kg',
          unitPrice: Number(currentService.price),
          perfumeVariant: perfumeVariant || 'Lavender',
          addons,
          notes: isUnderMinimum
            ? `${compiledNotes ? `${compiledNotes}; ` : ''}(Timbangan fisik: ${weightKg.toFixed(1)} Kg, min order ${minOrderQty} Kg)`
            : compiledNotes || undefined,
        },
      ],
      totalPieces: Math.max(1, Math.round(Number(totalPieces || 1))),
      perfumeVariant: perfumeVariant || 'Lavender',
      estimatedReadyHours: Math.max(1, Math.round(Number(currentService.durationHours || 24))),
      depositAmount: paymentChoice === 'PAID' ? Number(grandTotal) : paymentChoice === 'PARTIAL' ? Number(depositAmount) : 0,
      discountAmount: 0,
      paymentMethod: paymentChoice === 'UNPAID' ? 'UNPAID' : paymentMethod,
      customerNotes: compiledNotes || undefined,
    };

    const completeOfflineDropoff = async () => {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const tempInvoice = `LD-OFFLINE-${dateStr}-${randomSuffix}`;

      const tempOrderData: LaundryQueueOrder = {
        id: clientUuid,
        orderId: clientUuid,
        invoiceNumber: tempInvoice,
        customerName: customerName.trim(),
        customerPhone: formattedPhone || null,
        customerAddress: deliveryType !== 'NONE' ? deliveryAddress.trim() || null : null,
        deliveryType: deliveryType,
        deliveryDistanceKm: 0,
        deliveryFee: deliveryFee,
        status: 'RECEIVED',
        currentStage: 'DROP_OFF',
        serviceName: currentService.name,
        totalWeightKg: weightKg,
        totalPieces: totalPieces,
        perfumeVariant: perfumeVariant,
        rackCode: null,
        grandTotal: Number(grandTotal),
        paidAmount:
          paymentChoice === 'PAID'
            ? Number(grandTotal)
            : paymentChoice === 'PARTIAL'
            ? Number(depositAmount)
            : 0,
        paymentStatus:
          paymentChoice === 'PAID' ? 'PAID' : paymentChoice === 'PARTIAL' ? 'PARTIALLY_PAID' : 'UNPAID',
        createdAt: now.toISOString(),
        estimatedReadyAt: new Date(
          Date.now() + (currentService.durationHours || 24) * 3600000
        ).toISOString(),
        customerNotes: compiledNotes ? `${compiledNotes} [OFFLINE]` : '[OFFLINE]',
        items: [
          {
            name: currentService.name,
            quantity: billedQty,
            unit: currentService.unit,
            unitPrice: currentService.price,
            subtotal: subtotal,
            notes: compiledNotes || undefined,
          },
        ],
      };

      await saveOfflineOrder({
        offlineId: clientUuid,
        orderKind: 'LAUNDRY',
        clientRequestId: clientUuid,
        createdAt: now.toISOString(),
        outletId: activeOutlet.id,
        shiftId: currentShift.id,
        cashierName: currentUser?.name || 'Kasir Laundry',
        payload: {
          ...payload,
          offlineReferenceId: clientUuid,
          clientRequestId: clientUuid,
        },
        tempOrder: tempOrderData,
        status: 'PENDING',
        retryCount: 0,
      });

      onOrderCreated(tempOrderData);
      window.dispatchEvent(new CustomEvent('wellpos:laundry_order_created', { detail: tempOrderData }));
      onClose();
    };

    try {
      if (!navigator.onLine) {
        await completeOfflineDropoff();
        return;
      }

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
          customerPhone: orderData.customer?.phone || formattedPhone || null,
          customerAddress: deliveryType !== 'NONE' ? deliveryAddress.trim() || null : null,
          deliveryType: deliveryType,
          deliveryDistanceKm: 0,
          deliveryFee: deliveryFee,
          status: orderData.laundryDetail?.status || 'RECEIVED',
          currentStage: (orderData.laundryDetail as any)?.currentStage || 'DROP_OFF',
          serviceName: currentService.name,
          totalWeightKg: orderData.laundryDetail?.totalWeightKg ? Number(orderData.laundryDetail.totalWeightKg) : weightKg,
          totalPieces: orderData.laundryDetail?.totalPieces || totalPieces,
          perfumeVariant: perfumeVariant,
          rackCode: orderData.laundryDetail?.rackCode || null,
          grandTotal: Number(orderData.totalAmount || grandTotal),
          paidAmount: Number(
            orderData.paidAmount || (paymentChoice === 'PAID' ? grandTotal : paymentChoice === 'PARTIAL' ? depositAmount : 0)
          ),
          paymentStatus: orderData.paymentStatus,
          createdAt: orderData.createdAt,
          estimatedReadyAt:
            orderData.laundryDetail?.estimatedReadyAt ||
            new Date(Date.now() + (currentService.durationHours || 24) * 3600000).toISOString(),
          customerNotes: compiledNotes || null,
          items: [
            {
              name: currentService.name,
              quantity: billedQty,
              unit: currentService.unit,
              unitPrice: currentService.price,
              subtotal: subtotal,
              notes: compiledNotes || undefined,
            },
          ],
        };

        // Notify caller and dispatch global refresh event
        onOrderCreated(newQueueOrder);
        window.dispatchEvent(new CustomEvent('wellpos:laundry_order_created', { detail: newQueueOrder }));

        onClose();
      } else if ((res as any)?.offline === true) {
        if (isDigitalOrWallet) {
          setErrorMsg(
            'Pembayaran digital atau saldo deposit / kuota membutuhkan koneksi internet aktif. Gunakan metode Tunai atau Bayar Nanti saat offline.'
          );
        } else {
          await completeOfflineDropoff();
        }
      } else {
        setErrorMsg(res.message || 'Gagal menyimpan transaksi laundry');
      }
    } catch (err: any) {
      const isNetworkFailure =
        !navigator.onLine ||
        err?.name === 'TypeError' ||
        String(err?.message || '').toLowerCase().includes('fetch') ||
        String(err?.message || '').toLowerCase().includes('network');

      if (isNetworkFailure) {
        if (isDigitalOrWallet) {
          setErrorMsg(
            'Pembayaran digital atau saldo deposit / kuota membutuhkan koneksi internet aktif. Gunakan metode Tunai atau Bayar Nanti saat offline.'
          );
        } else {
          try {
            await completeOfflineDropoff();
          } catch {
            setErrorMsg(err?.message || 'Terjadi kesalahan sistem saat menyimpan antrean offline');
          }
        }
      } else {
        setErrorMsg(err.message || 'Terjadi kesalahan sistem saat memproses transaksi');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] overflow-hidden border border-slate-200"
        role="dialog"
        aria-modal="true"
      >
        {/* ── 1. MODAL HEADER ──────────────────────────────────────────────── */}
        <div className="p-4 sm:px-6 bg-slate-50 border-b border-slate-200/90 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-900 text-white flex items-center justify-center shadow-md shadow-blue-950/20 shrink-0">
              <Shirt className="w-5 h-5 stroke-[2.3]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm sm:text-base text-slate-900">
                  Input Cepat Cucian
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900">
                  Cepat
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate max-w-[240px] sm:max-w-xs">
                {activeOutlet?.name || 'Toko Laundry'} • Timbangan instan
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenFullPos && (
              <button
                type="button"
                onClick={onOpenFullPos}
                className="hidden sm:flex items-center gap-1 py-1.5 px-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
                title="Buka Terminal Kasir Lengkap"
              >
                <ExternalLink className="w-3.5 h-3.5 text-blue-900" />
                <span>Kasir Lengkap</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── 2. SCROLLABLE FORM BODY ───────────────────────────────────────── */}
        <form
          id="quick-dropoff-form"
          onSubmit={handleSubmitOrder}
          className="flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5"
        >
          {!currentShift && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 flex items-center justify-between gap-3 text-xs text-amber-900 shadow-xs animate-in fade-in">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                <span className="font-bold truncate">Shift kasir belum dibuka. Buka shift agar pencatatan kas akurat.</span>
              </div>
              <button
                type="button"
                onClick={() => setStartShiftModalOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs shrink-0 cursor-pointer shadow-xs active:scale-95 transition-all"
              >
                Buka Shift Sekarang
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-rose-800 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 2.1 SECTION: DATA PELANGGAN (FAST CRM / WALK-IN) */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-900" />
                Data Pelanggan
              </span>
              {selectedCustomer && (
                <button
                  type="button"
                  onClick={handleClearCustomer}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-bold normal-case cursor-pointer"
                >
                  Ganti Pelanggan
                </button>
              )}
            </label>

            {!selectedCustomer ? (
              <div className="space-y-2 relative">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    ref={customerInputRef}
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setCustomerName(e.target.value);
                      setShowCustomerDropdown(true);
                    }}
                    onFocus={() => setShowCustomerDropdown(true)}
                    placeholder="Ketik nama atau cari pelanggan member..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-[13px] sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
                  />
                </div>

                {/* Autocomplete Dropdown */}
                {showCustomerDropdown && filteredCustomers.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden divide-y divide-slate-100">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCustomer(c)}
                        className="w-full text-left p-3 hover:bg-blue-50 transition-colors flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <div className="font-bold text-xs text-slate-900">{c.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">{c.phone || '-'}</div>
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900">
                          Pilih Member
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="pt-1">
                  <WhatsAppInput
                    label="Nomor WhatsApp (Opsional untuk Kirim Struk)"
                    value={customerPhone}
                    onChange={(val) => setCustomerPhone(val)}
                    placeholder="81234567890"
                  />
                </div>
              </div>
            ) : (
              /* Selected Customer Card */
              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                    {selectedCustomer.name?.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-slate-900 truncate">
                        {selectedCustomer.name}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-200/80 text-blue-900 shrink-0">
                        Member
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">
                      {selectedCustomer.phone || '-'}
                    </div>
                  </div>
                </div>

                {loadingWallet ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-900" />
                ) : customerWallet ? (
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-slate-500 font-bold">Saldo Kuota</div>
                    <div className="text-xs font-black text-emerald-700 font-mono">
                      {customerWallet.quotaKg?.toFixed(1) || 0} Kg
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          {/* ── 2.2 SECTION: PEMILIHAN LAYANAN LAUNDRY ────────────────────────── */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-900" />
                Pilih Layanan Laundry
              </label>

              {/* Category Pills */}
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-0.5">
                {[
                  { id: 'ALL', label: 'Semua' },
                  { id: 'KILOAN', label: 'Kiloan' },
                  { id: 'SATUAN', label: 'Satuan' },
                  { id: 'EXPRESS', label: 'Express' },
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setActiveCategory(cat.id)}
                    className={`py-1 px-2.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                      activeCategory === cat.id
                        ? 'bg-blue-900 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Bar Layanan (Cepat Temukan dari Katalog) */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={serviceSearch}
                onChange={(e) => setServiceSearch(e.target.value)}
                placeholder="Cari layanan (cuci komplit, bedcover, jas, express)..."
                className="w-full pl-10 pr-8 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
              />
              {serviceSearch && (
                <button
                  type="button"
                  onClick={() => setServiceSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-200 transition-colors cursor-pointer text-xs font-black"
                >
                  ✕
                </button>
              )}
            </div>

            {loadingServices ? (
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin text-blue-900" />
                <span>Memuat katalog layanan...</span>
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
                Tidak ada layanan untuk kategori ini.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {filteredServices.map((srv) => {
                  const isSelected = selectedServiceId === srv.id;
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => {
                        setSelectedServiceId(srv.id);
                        if (srv.minOrderQty && weightKg < Number(srv.minOrderQty)) {
                          setWeightKg(Number(srv.minOrderQty));
                        }
                      }}
                      className={`p-3 rounded-2xl text-left border transition-all cursor-pointer relative flex flex-col justify-between ${
                        isSelected
                          ? 'bg-blue-50/70 border-blue-900 ring-2 ring-blue-900/10 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1.5 mb-1.5">
                        <span className="font-black text-xs text-slate-900 leading-tight line-clamp-2">
                          {srv.name}
                        </span>
                        {isSelected && (
                          <div className="w-4 h-4 rounded-full bg-blue-900 text-white flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-baseline justify-between mt-auto pt-1 border-t border-slate-100 text-[11px]">
                        <span className="font-black text-blue-950 font-mono">
                          Rp {Number(srv.price).toLocaleString('id-ID')}
                        </span>
                        <span className="text-slate-400 text-[10px] font-semibold">{formatServiceUnit(srv.unit)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── 2.3 SECTION: TIMBANGAN BOBOT & JUMLAH POTONG ─────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Bobot Timbangan Stepper (Kg) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5 text-blue-900" />
                  Bobot Timbangan (Kg)
                </span>
                {isUnderMinimum && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                    Min {minOrderQty} Kg
                  </span>
                )}
              </div>

              {/* Finger Stepper Control */}
              <div className="flex items-center justify-between gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handleWeightDelta(-0.5)}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 flex items-center justify-center font-bold transition-all cursor-pointer"
                  title="Kurang 0.5 Kg"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <div className="flex-1 text-center font-mono">
                  <span className="text-xl sm:text-2xl font-black text-slate-900">
                    {weightKg.toFixed(1)}
                  </span>
                  <span className="text-xs text-slate-400 font-bold ml-1">Kg</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleWeightDelta(0.5)}
                  className="w-10 h-10 rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-95 text-white flex items-center justify-center font-bold shadow-xs transition-all cursor-pointer"
                  title="Tambah 0.5 Kg"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Weight Chips */}
              <div className="flex items-center justify-between gap-1 pt-1">
                {[3, 5, 7, 10].map((kg) => (
                  <button
                    key={kg}
                    type="button"
                    onClick={() => setWeightKg(kg)}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                      weightKg === kg
                        ? 'bg-blue-900 text-white border-blue-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {kg} Kg
                  </button>
                ))}
              </div>
            </div>

            {/* Jumlah Helai Pakaian Stepper (Pcs) */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
              <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                <Shirt className="w-3.5 h-3.5 text-blue-900" />
                Jumlah Potong (Pcs)
              </span>

              <div className="flex items-center justify-between gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => handlePiecesDelta(-1)}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 flex items-center justify-center font-bold transition-all cursor-pointer"
                  title="Kurang 1 Potong"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <div className="flex-1 text-center font-mono">
                  <span className="text-xl sm:text-2xl font-black text-slate-900">
                    {totalPieces}
                  </span>
                  <span className="text-xs text-slate-400 font-bold ml-1">Pcs</span>
                </div>

                <button
                  type="button"
                  onClick={() => handlePiecesDelta(1)}
                  className="w-10 h-10 rounded-xl bg-blue-900 hover:bg-blue-800 active:scale-95 text-white flex items-center justify-center font-bold shadow-xs transition-all cursor-pointer"
                  title="Tambah 1 Potong"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Pieces Chips */}
              <div className="flex items-center justify-between gap-1 pt-1">
                {[5, 10, 15, 20].map((pcs) => (
                  <button
                    key={pcs}
                    type="button"
                    onClick={() => setTotalPieces(pcs)}
                    className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                      totalPieces === pcs
                        ? 'bg-blue-900 text-white border-blue-900'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {pcs} Pcs
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── 2.4 SECTION: PILIHAN PARFUM & SPOT CATATAN ───────────────────── */}
          <div className="space-y-3 pt-1">
            {/* Pilihan Aroma Parfum: Hanya tampil jika ada varian parfum aktif di toko */}
            {perfumesList.length > 0 && (
              <div>
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-blue-900" />
                  Aroma Parfum Laundry
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {perfumesList.map((perfume) => {
                    const isSelected = perfumeVariant.toLowerCase() === perfume.name.toLowerCase();
                    return (
                      <button
                        key={perfume.id || perfume.name}
                        type="button"
                        onClick={() => setPerfumeVariant(perfume.name)}
                        className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-blue-900 text-white border-blue-900 shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{perfume.name}</span>
                        {Number(perfume.extraPrice || 0) > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-black ${
                            isSelected ? 'bg-blue-800 text-blue-100' : 'bg-blue-100 text-blue-900'
                          }`}>
                            +Rp {Number(perfume.extraPrice).toLocaleString('id-ID')}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Spotting Notes & Khusus */}
            <div>
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Clock className="w-3.5 h-3.5 text-blue-900" />
                Catatan Khusus / Pre-treatment (Spotting)
              </label>
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                {QUICK_SPOT_NOTES.map((note) => {
                  const active = selectedSpotNotes.includes(note);
                  return (
                    <button
                      key={note}
                      type="button"
                      onClick={() => handleToggleSpotNote(note)}
                      className={`py-1 px-2.5 rounded-lg text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1 ${
                        active
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {active && <Check className="w-3 h-3 stroke-[3]" />}
                      <span>{note}</span>
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Catatan tambahan (contoh: luntur, resleting rusak)..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-900 focus:border-blue-900 transition-all"
              />
            </div>
          </div>

          {/* ── SECTION: MODA ANTAR-JEMPUT (DELIVERY) ────────────────────────── */}
          <div className="space-y-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-900" />
                Moda Antar-Jemput
              </label>
              {deliveryType !== 'NONE' && (
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                  isFreeDelivery
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-blue-100 text-blue-900'
                }`}>
                  {isFreeDelivery ? 'Gratis Ongkir' : `Ongkir: Rp ${deliveryFee.toLocaleString('id-ID')}`}
                </span>
              )}
            </div>

            {/* Segmented Tipe Delivery */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center leading-tight cursor-pointer ${
                    deliveryType === dt.key
                      ? 'bg-blue-900 text-white border-blue-900 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {dt.label}
                </button>
              ))}
            </div>

            {/* Detail Zona & Alamat */}
            {deliveryType !== 'NONE' && (
              <div className="pt-2 border-t border-slate-200/80 space-y-2 animate-fadeIn">
                {deliveryConfig?.zones && deliveryConfig.zones.length > 0 && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">Pilih Zona / Tarif Antar</label>
                    <div className="relative">
                      <select
                        value={deliveryZoneId}
                        onChange={(e) => setDeliveryZoneId(e.target.value)}
                        className="w-full appearance-none pr-10 pl-3 py-2 bg-white border border-slate-300 rounded-xl text-[13px] sm:text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-900"
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
                  <label className="text-xs font-bold text-slate-700">Alamat Lengkap Pengantaran / Penjemputan</label>
                  <textarea
                    rows={2}
                    placeholder="Masukkan alamat lengkap (jalan, nomor, patokan rumah)..."
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-[13px] sm:text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-900 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Catatan Khusus Kurir (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Titip satpam komplek / jemput sore"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-[13px] sm:text-sm font-medium text-slate-800 focus:outline-none focus:border-blue-900"
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── 2.5 SECTION: PILIHAN PEMBAYARAN ───────────────────────────────── */}
          <div className="space-y-2.5 pt-1">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-blue-900" />
              Metode &amp; Status Pembayaran
            </label>

            {/* Status Pills */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'PAID', label: 'Bayar Sekarang', sub: 'Lunas' },
                { id: 'UNPAID', label: 'Bayar Nanti', sub: 'Saat Ambil' },
                { id: 'PARTIAL', label: 'Uang Muka (DP)', sub: 'Cicil' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPaymentChoice(opt.id as any)}
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                    paymentChoice === opt.id
                      ? 'bg-blue-900 text-white border-blue-900 shadow-xs'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-extrabold text-xs">{opt.label}</span>
                  <span className={`text-[10px] ${paymentChoice === opt.id ? 'text-blue-200' : 'text-slate-400'}`}>
                    {opt.sub}
                  </span>
                </button>
              ))}
            </div>

            {/* Deposit Input if PARTIAL */}
            {paymentChoice === 'PARTIAL' && (
              <div className="pt-1">
                <CurrencyInput
                  label="Nominal Uang Muka (DP)"
                  value={depositAmount}
                  onChange={(num) => setDepositAmount(num)}
                  placeholder="0"
                />
              </div>
            )}

            {/* Opsi Metode Pembayaran (Lunas atau DP) */}
            {(paymentChoice === 'PAID' || paymentChoice === 'PARTIAL') && (
              <div className="space-y-2 pt-1 animate-fadeIn">
                <div className="flex items-center gap-1.5">
                  {[
                    { id: 'CASH', label: 'Tunai', icon: Banknote },
                    { id: 'QRIS', label: 'QRIS', icon: QrCode },
                    { id: 'TRANSFER', label: 'Transfer', icon: CreditCard },
                  ]
                    .filter((m) => m.id !== 'QRIS' || isQrisActive)
                    .map((m) => {
                      const Icon = m.icon;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPaymentMethod(m.id as any)}
                          className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                            paymentMethod === m.id
                              ? 'bg-blue-900 border-blue-900 text-white shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                </div>

                {/* Opsi Dompet: Saldo Deposit & Kuota Kiloan (jika pelanggan terdaftar) */}
                {selectedCustomer && customerWallet && (
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    {/* Tombol Saldo Deposit */}
                    <button
                      type="button"
                      disabled={Number(customerWallet.balanceAmount) <= 0}
                      onClick={() => setPaymentMethod('CUSTOMER_DEPOSIT')}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border flex items-center justify-between transition-all cursor-pointer ${
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
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-bold border flex items-center justify-between transition-all cursor-pointer ${
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

                {/* Kartu Pratinjau QRIS Statis */}
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
                            Nominal Bayar: Rp {(paymentChoice === 'PAID' ? grandTotal : depositAmount).toLocaleString('id-ID')}
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
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </form>

        {/* Banner peringatan jika nama pelanggan belum diisi (di luar baris footer agar tidak menjepit nominal) */}
        {!customerName.trim() && (
          <div className="bg-amber-50 border-t border-amber-200/80 px-4 sm:px-6 py-2 flex items-center justify-between gap-2 shrink-0 text-amber-800 text-xs font-bold">
            <span className="flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Isi nama pelanggan untuk menyimpan transaksi</span>
            </span>
            <span className="text-[11px] text-amber-600 font-medium hidden sm:inline">Wajib untuk cetak nota &amp; tag pakaian</span>
          </div>
        )}

        {/* ── 3. STICKY ACTION FOOTER (IPHONE SAFE AREA COMPLIANT) ─────────── */}
        <div
          className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
        >
          <div className="flex items-center justify-between sm:justify-start gap-4 shrink-0 w-full sm:w-auto">
            <div className="shrink-0">
              <div className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-500">
                Total Tagihan
              </div>
              <div className="text-lg sm:text-xl font-black text-blue-950 tabular-nums whitespace-nowrap shrink-0">
                Rp {grandTotal.toLocaleString('id-ID')}
              </div>
            </div>
            {deliveryType !== 'NONE' && (
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap shrink-0 ${
                deliveryFee === 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-900'
              }`}>
                {deliveryFee === 0 ? '✓ Bebas Ongkir' : `+ Ongkir Rp ${deliveryFee.toLocaleString('id-ID')}`}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer shrink-0"
            >
              Batal
            </button>
            <button
              type="submit"
              form="quick-dropoff-form"
              onClick={handleSubmitOrder}
              disabled={submitting || !currentService || !customerName.trim()}
              className="flex-1 sm:flex-none py-2.5 px-5 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black text-xs shadow-md shadow-blue-950/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              title={!customerName.trim() ? 'Isi nama pelanggan untuk menyimpan' : 'Simpan transaksi dan cetak tag thermal'}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <span>Simpan &amp; Cetak Tag</span>
                  <Check className="w-4 h-4 stroke-[2.5]" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Modal Buka Shift Kasir */}
      <StartShiftModal
        isOpen={startShiftModalOpen}
        onClose={() => setStartShiftModalOpen(false)}
        onShiftStarted={(newShift) => {
          setCurrentShift(newShift);
          setStartShiftModalOpen(false);
          setErrorMsg(null);
        }}
      />
    </div>
  );
};
