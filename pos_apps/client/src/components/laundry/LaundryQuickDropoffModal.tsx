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
} from 'lucide-react';
import type { Outlet } from '../../types/outlet';
import type { LaundryService, LaundryQueueOrder, CustomerLaundryWallet } from '../../types/laundry';
import { api, customerApi } from '../../services/api';
import { WhatsAppInput, CurrencyInput } from '../ui';
import { generateIdempotencyKey } from '../../utils/offlineQueue';

interface LaundryQuickDropoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeOutlet: Outlet | null;
  currentUser: any;
  onOrderCreated: (order: LaundryQueueOrder) => void;
  onOpenFullPos?: () => void;
}

const PERFUME_OPTIONS = [
  'Lavender',
  'Ocean Fresh',
  'Akasia',
  'Snappy',
  'Sakura',
  'Tanpa Parfum',
];

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
  const [selectedSpotNotes, setSelectedSpotNotes] = useState<string[]>([]);
  const [customNotes, setCustomNotes] = useState('');

  // Payment Options
  const [paymentChoice, setPaymentChoice] = useState<'PAID' | 'UNPAID' | 'PARTIAL'>('PAID');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'QRIS' | 'TRANSFER'>('CASH');
  const [depositAmount, setDepositAmount] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  // Fetch Services & Initial Customers when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let mounted = true;
    setLoadingServices(true);
    setErrorMsg(null);

    Promise.all([
      api.getLaundryServices().catch(() => ({ status: 'error', data: [] })),
      customerApi.getCustomers({ limit: 50 }).catch(() => ({ status: 'error', data: [] })),
    ]).then(([srvRes, custRes]) => {
      if (!mounted) return;
      if (srvRes.status === 'success' && Array.isArray(srvRes.data)) {
        setServices(srvRes.data);
        // Default to first active non-ADDON service (prefer KILOAN)
        const nonAddons = srvRes.data.filter(
          (s: LaundryService) => s.category !== 'ADDON' && s.isActive !== false
        );
        const firstKiloan = nonAddons.find(
          (s: LaundryService) => s.category === 'KILOAN'
        );
        const def = firstKiloan || nonAddons[0] || srvRes.data[0];
        if (def) {
          setSelectedServiceId(def.id);
          if (def.minOrderQty) {
            setWeightKg(Math.max(3.0, Number(def.minOrderQty)));
          }
        }
      }
      if (custRes.status === 'success' && Array.isArray(custRes.data)) {
        setCustomersList(custRes.data);
      }
      setLoadingServices(false);
    });

    return () => {
      mounted = false;
    };
  }, [isOpen, activeOutlet?.id]);

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

  // Calculate Subtotal & Billed Quantity
  const { billedQty, isUnderMinimum, minOrderQty, subtotal } = useMemo(() => {
    if (!currentService) return { billedQty: 0, isUnderMinimum: false, minOrderQty: 0, subtotal: 0 };

    const minQty = Number(currentService.minOrderQty) || 0;
    const isKiloan = currentService.category === 'KILOAN' || currentService.unit.toLowerCase() === 'kg';
    const underMin = isKiloan && minQty > 0 && weightKg < minQty;
    const billed = isKiloan ? (underMin ? minQty : weightKg) : weightKg;
    const total = billed * Number(currentService.price);

    return {
      billedQty: billed,
      isUnderMinimum: underMin,
      minOrderQty: minQty,
      subtotal: total,
    };
  }, [currentService, weightKg]);

  // Submission Handler
  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
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

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const allNotesArray = [...selectedSpotNotes];
      if (customNotes.trim()) allNotesArray.push(customNotes.trim());
      const compiledNotes = allNotesArray.join('; ');

      const formattedPhone = customerPhone
        ? customerPhone.startsWith('+62')
          ? customerPhone
          : `+62${customerPhone.replace(/^0+/, '')}`
        : undefined;

      const payload = {
        outletId: activeOutlet.id,
        customerId: selectedCustomer?.id || undefined,
        customerName: customerName.trim(),
        customerPhone: formattedPhone,
        deliveryType: 'SELF_PICKUP',
        deliveryDistanceKm: 0,
        deliveryFeePerKm: 0,
        deliveryFee: 0,
        items: [
          {
            serviceId: currentService.id,
            name: currentService.name,
            category: currentService.category,
            quantity: Number(billedQty),
            unit: currentService.unit || 'Kg',
            unitPrice: Number(currentService.price),
            addons: [],
            notes: isUnderMinimum
              ? `${compiledNotes ? `${compiledNotes}; ` : ''}(Timbangan fisik: ${weightKg.toFixed(1)} Kg, min order ${minOrderQty} Kg)`
              : compiledNotes || undefined,
          },
        ],
        totalPieces: Math.max(1, Math.round(Number(totalPieces || 1))),
        perfumeVariant: perfumeVariant || 'Lavender',
        estimatedReadyHours: Math.max(1, Math.round(Number(currentService.durationHours || 24))),
        depositAmount: paymentChoice === 'PAID' ? Number(subtotal) : paymentChoice === 'PARTIAL' ? Number(depositAmount) : 0,
        discountAmount: 0,
        paymentMethod: paymentChoice === 'UNPAID' ? 'UNPAID' : paymentMethod,
        customerNotes: compiledNotes || undefined,
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
          customerPhone: orderData.customer?.phone || formattedPhone || null,
          customerAddress: null,
          deliveryType: 'SELF_PICKUP',
          deliveryDistanceKm: 0,
          deliveryFee: 0,
          status: orderData.laundryDetail?.status || 'RECEIVED',
          currentStage: (orderData.laundryDetail as any)?.currentStage || 'DROP_OFF',
          serviceName: currentService.name,
          totalWeightKg: orderData.laundryDetail?.totalWeightKg ? Number(orderData.laundryDetail.totalWeightKg) : weightKg,
          totalPieces: orderData.laundryDetail?.totalPieces || totalPieces,
          perfumeVariant: perfumeVariant,
          rackCode: orderData.laundryDetail?.rackCode || null,
          grandTotal: Number(orderData.totalAmount || subtotal),
          paidAmount: Number(
            orderData.paidAmount || (paymentChoice === 'PAID' ? subtotal : paymentChoice === 'PARTIAL' ? depositAmount : 0)
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
      } else {
        setErrorMsg(res.message || 'Gagal menyimpan transaksi laundry');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan sistem saat memproses transaksi');
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
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-900/20 focus:border-blue-900 transition-all"
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
            {/* Pilihan Aroma Parfum */}
            <div>
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-900" />
                Aroma Parfum Laundry
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {PERFUME_OPTIONS.map((perfume) => (
                  <button
                    key={perfume}
                    type="button"
                    onClick={() => setPerfumeVariant(perfume)}
                    className={`py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      perfumeVariant === perfume
                        ? 'bg-indigo-900 text-white border-indigo-900 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {perfume}
                  </button>
                ))}
              </div>
            </div>

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

            {/* Payment Method Sub-selection if PAID */}
            {paymentChoice === 'PAID' && (
              <div className="flex items-center gap-2 pt-1">
                {[
                  { id: 'CASH', label: 'Tunai', icon: Banknote },
                  { id: 'QRIS', label: 'QRIS', icon: QrCode },
                  { id: 'TRANSFER', label: 'Transfer', icon: CreditCard },
                ].map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        paymentMethod === m.id
                          ? 'bg-blue-50 border-blue-900 text-blue-950 font-black'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

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
          </div>
        </form>

        {/* ── 3. STICKY ACTION FOOTER (IPHONE SAFE AREA COMPLIANT) ─────────── */}
        <div
          className="p-4 sm:px-6 bg-slate-50 border-t border-slate-200 shrink-0 flex items-center justify-between gap-4"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}
        >
          <div>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
              Total Tagihan
            </div>
            <div className="text-xl sm:text-2xl font-black text-blue-950 font-mono">
              Rp {subtotal.toLocaleString('id-ID')}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!customerName.trim() && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Isi nama pelanggan untuk simpan</span>
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              form="quick-dropoff-form"
              onClick={handleSubmitOrder}
              disabled={submitting || !currentService}
              className="py-2.5 px-5 rounded-xl bg-blue-900 hover:bg-blue-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black text-xs shadow-md shadow-blue-950/20 active:scale-98 transition-all flex items-center gap-2 cursor-pointer"
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
    </div>
  );
};
