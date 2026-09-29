import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { QrCode, ArrowRight, X, Clock } from 'lucide-react';
import type { Product, Category } from '../types/product';
import type { CartItem, PaymentPayload, Order, HoldOrder, OrderChannel, OpenTabOrder, OpenTabPayload } from '../types/order';
import type { Shift } from '../types/shift';
import type { Customer } from '../types/customer';
import type { Outlet, OutletFee } from '../types/outlet';
import { normalizeOutletFees } from '../types/outlet';
import type { QrTable, QrLiveOrder } from '../types/qr_menu';
import type { Promotion } from '../types/promotion';
import { formatRupiah } from '../utils/currency';
import {
  PosHeader,
  CategoryFilterPills,
  ProductCatalogGrid,
  OrderCartSidebar,
  HoldOrdersModal,
  OpenTabsModal,
  PosMobileView,
} from '../components/pos';
import { VoucherSelectionModal } from '../components/pos/VoucherSelectionModal';
import { SplitBillModal } from '../components/pos/SplitBillModal';
import { PaymentModal } from '../components/PaymentModal';
import { OrderSuccessModal } from '../components/OrderSuccessModal';
import { StartShiftModal } from '../components/StartShiftModal';
import { XReportModal } from '../components/XReportModal';
import { CloseShiftModal } from '../components/CloseShiftModal';
import { CashExpenseModal } from '../components/CashExpenseModal';
import { UpgradeModal } from '../components/UpgradeModal';
import { SupervisorFeesModal } from '../components/SupervisorFeesModal';
import { OnDemandFeesPickerModal } from '../components/OnDemandFeesPickerModal';
import { ProductModifierModal } from '../components/ProductModifierModal';
import { usePlan } from '../hooks/usePlan';
import { useDialog } from '../context/DialogContext';
import { api, customerApi, authStorage } from '../services/api';
import type { User } from '../types/auth';

interface PosTerminalViewProps {
  activeOutlet?: Outlet | null;
  currentUserRole?: string;
  currentUser?: User | null;
  onOutletFeesUpdated?: (fees: OutletFee[]) => void;
  appendOrderData?: Order | null;
  onClearAppendOrder?: () => void;
  loadQrOrderData?: QrLiveOrder | null;
  onClearLoadQrOrder?: () => void;
  onNavigateTab?: (tab: string) => void;
  onLogout?: () => void;
  allowedTabs?: string[];
}

export const PosTerminalView: React.FC<PosTerminalViewProps> = ({
  activeOutlet,
  currentUserRole,
  currentUser,
  onOutletFeesUpdated,
  appendOrderData,
  onClearAppendOrder,
  loadQrOrderData,
  onClearLoadQrOrder,
  onNavigateTab,
  onLogout,
  allowedTabs,
}) => {
  const { isFree } = usePlan();
  const dialog = useDialog();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState(
    'Fitur Split Bill & Tahan Antrean tersedia di Paket Pro. Upgrade sekarang untuk mengaktifkan!'
  );
  const [upgradeFeatureHighlight, setUpgradeFeatureHighlight] = useState('Split Bill & Tahan Antrean');

  const triggerProUpgrade = (featureName: string) => {
    setUpgradeFeatureHighlight(featureName);
    setUpgradeMessage(`Fitur ${featureName} tersedia di Paket Pro. Upgrade sekarang untuk mengaktifkan!`);
    setUpgradeModalOpen(true);
  };

  // Catalog State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Barcode Search State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchBarcode, setSearchBarcode] = useState('');
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // Auto-dismiss scan/order notification banner after 4 seconds
  useEffect(() => {
    if (!scanMessage) return;
    const timer = setTimeout(() => {
      setScanMessage(null);
    }, 4000);
    return () => clearTimeout(timer);
  }, [scanMessage]);

  // Screen width & Handheld view state (Optimized for 6.8" portrait smartphone)
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false
  );
  const [handheldModeOverride, setHandheldModeOverride] = useState<boolean | null>(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isHandheld = handheldModeOverride !== null ? handheldModeOverride : isMobileScreen;

  // View Mode: 'grid' vs 'compact'
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');

  // Order Channel
  const [orderChannel, setOrderChannel] = useState<OrderChannel>('DINE_IN');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);
  const [appliedPromotion, setAppliedPromotion] = useState<Promotion | null>(null);
  const [voucherModalOpen, setVoucherModalOpen] = useState<boolean>(false);
  const [splitBillModalOpen, setSplitBillModalOpen] = useState<boolean>(false);

  // CRM Members
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Modifier Selection State
  const [modifierModalOpen, setModifierModalOpen] = useState(false);
  const [selectedProductForModifier, setSelectedProductForModifier] = useState<Product | null>(null);

  // On-Demand Packaging Fees
  const [onDemandQuantities, setOnDemandQuantities] = useState<Record<string, number>>({});
  const [onDemandPickerOpen, setOnDemandPickerOpen] = useState<boolean>(false);

  // Table & QR Order Integration
  const [tableNumber, setTableNumber] = useState<string>('');
  const [onlineOrderId, setOnlineOrderId] = useState<string>('');
  const [tables, setTables] = useState<QrTable[]>([]);
  const [qrOrders, setQrOrders] = useState<QrLiveOrder[]>([]);
  const [qrOrdersModalOpen, setQrOrdersModalOpen] = useState<boolean>(false);

  // Open Tabs (Tagihan Meja Terbuka / Bayar Nanti) State
  const [openTabs, setOpenTabs] = useState<OpenTabOrder[]>([]);
  const [openTabsModalOpen, setOpenTabsModalOpen] = useState<boolean>(false);
  const [activeOpenTab, setActiveOpenTab] = useState<OpenTabOrder | null>(null);

  // Active Pulled Order (Pesanan QR / Tagihan Meja yang sedang dibuka di kasir)
  const [activePulledOrder, setActivePulledOrder] = useState<{
    id: string;
    invoiceNumber: string;
    tableNumber: string;
    customerName: string;
    customerPhone?: string;
    channel: string;
    source: 'OPEN_TAB' | 'QR_MENU';
  } | null>(null);

  const loadOpenTabs = async (outletId?: string) => {
    if (!outletId) return;
    try {
      const res = await api.getOpenTabs(outletId);
      if (res.status === 'success' && res.data) {
        setOpenTabs(res.data);
      }
    } catch (err) {
      console.error('Gagal memuat open tabs:', err);
    }
  };

  const loadTablesAndOrders = async () => {
    if (!activeOutlet?.id) return;
    try {
      const [tablesRes, ordersRes, openTabsRes] = await Promise.all([
        api.getQrTables(activeOutlet.id),
        api.getQrLiveOrders(activeOutlet.id),
        api.getOpenTabs(activeOutlet.id),
      ]);
      if (tablesRes.status === 'success' && tablesRes.data) {
        setTables(tablesRes.data);
      }
      if (ordersRes.status === 'success' && ordersRes.data) {
        setQrOrders(ordersRes.data);
      }
      if (openTabsRes.status === 'success' && openTabsRes.data) {
        setOpenTabs(openTabsRes.data);
      }
    } catch (err) {
      console.error('Gagal memuat meja / pesanan QR / open tabs:', err);
    }
  };

  // Load Tables, QR Orders & Open Tabs
  // Fix S2: Polling di-pause saat browser tab tidak aktif (Page Visibility API)
  // untuk menghindari API calls sia-sia di background.
  useEffect(() => {
    if (!activeOutlet?.id) return;

    loadTablesAndOrders();

    let interval: ReturnType<typeof setInterval> | null = setInterval(loadTablesAndOrders, 10000);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab berpindah ke background — hentikan polling
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
      } else {
        // Tab kembali aktif — fetch langsung + mulai ulang polling
        loadTablesAndOrders();
        if (!interval) {
          interval = setInterval(loadTablesAndOrders, 10000);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [activeOutlet?.id]);

  const unpaidQrOrders = qrOrders.filter((o) => o.paymentStatus !== 'PAID');
  const prevQrCountRef = useRef<number | null>(null);

  // Notifikasi audio (chime) lembut saat ada pesanan meja QR baru masuk
  useEffect(() => {
    if (prevQrCountRef.current !== null && unpaidQrOrders.length > prevQrCountRef.current) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const now = ctx.currentTime;

          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = 'sine';
          osc1.frequency.setValueAtTime(587.33, now); // D5
          gain1.gain.setValueAtTime(0.12, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.35);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(880, now + 0.15); // A5
          gain2.gain.setValueAtTime(0.12, now + 0.15);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.15);
          osc2.stop(now + 0.6);
        }
      } catch (audioErr) {
        // Fallback jika browser membatasi autoplay
      }
    }
    prevQrCountRef.current = unpaidQrOrders.length;
  }, [unpaidQrOrders.length]);

  // Peta Meja Terisi (Occupied Tables Map)
  const occupiedTablesMap = useMemo(() => {
    const map: Record<
      string,
      {
        type: 'OPEN_TAB' | 'QR_ORDER';
        customerName: string;
        grandTotal: number;
        orderId: string;
        invoiceNumber: string;
      }
    > = {};

    openTabs.forEach((tab) => {
      if (tab.tableNumber) {
        map[tab.tableNumber.trim()] = {
          type: 'OPEN_TAB',
          customerName: tab.customerName || 'Tamu',
          grandTotal: tab.grandTotal,
          orderId: tab.id,
          invoiceNumber: tab.invoiceNumber,
        };
      }
    });

    unpaidQrOrders.forEach((qr) => {
      if (qr.tableNumber) {
        map[qr.tableNumber.trim()] = {
          type: 'QR_ORDER',
          customerName: qr.customerName || 'Tamu QR',
          grandTotal: qr.grandTotal,
          orderId: qr.id,
          invoiceNumber: qr.invoiceNumber,
        };
      }
    });

    return map;
  }, [openTabs, unpaidQrOrders]);

  const handlePullQrOrder = (order: QrLiveOrder) => {
    const newCartItems: CartItem[] = [];
    (order.items || []).forEach((item) => {
      if (!item || !item.productName) return;
      const matched = products.find(
        (p) =>
          (item.productId && p.id === item.productId) ||
          (p.name && item.productName && p.name.toLowerCase() === item.productName.toLowerCase())
      );
      if (matched) {
        newCartItems.push({
          cartItemId: `item_qr_${item.id || Date.now()}_${Math.random()}`,
          product: matched,
          quantity: item.quantity || 1,
          discountAmount: 0,
          itemNote: item.notes || (item.variantName ? `Varian: ${item.variantName}` : undefined),
          customPrice: Number(item.unitPrice) || matched.price || matched.basePrice,
        });
      } else {
        newCartItems.push({
          cartItemId: `item_qr_${item.id || Date.now()}_${Math.random()}`,
          product: {
            id: item.productId || item.id || `qr_${Date.now()}`,
            name: item.productName,
            basePrice: Number(item.unitPrice) || 0,
            price: Number(item.unitPrice) || 0,
            costPrice: 0,
            unit: 'Pcs',
            stock: 999,
            minStockAlert: 0,
            isActive: true,
            barcode: '',
            sku: '',
            category: { id: 'default', name: 'Menu QR' },
          },
          quantity: item.quantity || 1,
          discountAmount: 0,
          itemNote: item.notes || item.variantName,
          customPrice: Number(item.unitPrice) || 0,
        });
      }
    });

    setCart(newCartItems);
    setCustomerName(order.customerName || `Pelanggan Meja ${order.tableNumber}`);
    setCustomerPhone(order.customerPhone || '');
    setTableNumber(order.tableNumber);
    setOrderChannel('DINE_IN');
    setActivePulledOrder({
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      tableNumber: order.tableNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      channel: 'QR_MENU',
      source: 'QR_MENU',
    });
    setActiveOpenTab({
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      outletId: activeOutlet?.id || '',
      cashierId: '',
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      channel: 'QR_MENU',
      tableNumber: order.tableNumber,
      notes: order.notes,
      subtotal: order.subtotal,
      discountAmount: 0,
      taxAmount: order.taxAmount,
      serviceCharge: order.serviceCharge,
      grandTotal: order.grandTotal,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      cashier: { name: 'Pesanan Mandiri QR' },
      items: (order.items || []).map((it) => ({
        id: it.id,
        productId: it.productId || it.id,
        productName: it.productName,
        variantName: it.variantName,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountAmount: 0,
        subtotal: it.subtotal,
        notes: it.notes,
      })),
    });
    setQrOrdersModalOpen(false);
    setScanMessage(`Pesanan Meja ${order.tableNumber} (#${order.invoiceNumber}) berhasil dimuat.`);
  };

  useEffect(() => {
    if (loadQrOrderData) {
      handlePullQrOrder(loadQrOrderData);
      onClearLoadQrOrder?.();
    }
  }, [loadQrOrderData]);

  useEffect(() => {
    if (appendOrderData) {
      setCustomerName(`${appendOrderData.customerName || 'Pelanggan'} (Susulan #${appendOrderData.invoiceNumber})`);
      if (appendOrderData.channel) {
        setOrderChannel(appendOrderData.channel as OrderChannel);
      }
    }
  }, [appendOrderData]);

  // Dynamic Outlet Fees & Taxes
  const [supervisorFeesModalOpen, setSupervisorFeesModalOpen] = useState<boolean>(false);
  const [supervisorInitialTab, setSupervisorInitialTab] = useState<'TAX' | 'SERVICE' | 'PACKAGING'>('TAX');
  const [outletFees, setOutletFees] = useState<OutletFee[]>([]);
  const [isRefreshingFees, setIsRefreshingFees] = useState<boolean>(false);

  const refreshOutletFees = useCallback(async (silent = true) => {
    if (!activeOutlet?.id) return;
    try {
      if (!silent) setIsRefreshingFees(true);
      const res = await api.getOutlets();
      if (res.status === 'success' && Array.isArray(res.data)) {
        const found = res.data.find((o) => o.id === activeOutlet.id);
        if (found) {
          const normalized = normalizeOutletFees(found.feesConfig);
          setOutletFees(normalized);
          onOutletFeesUpdated?.(normalized);
        }
      }
    } catch (err) {
      console.error('Failed to refresh outlet fees:', err);
    } finally {
      if (!silent) setIsRefreshingFees(false);
    }
  }, [activeOutlet?.id, onOutletFeesUpdated]);

  useEffect(() => {
    setOutletFees(normalizeOutletFees(activeOutlet?.feesConfig));
    refreshOutletFees(true);
  }, [activeOutlet?.id, refreshOutletFees]);

  // Hold Orders State
  const [holdOrders, setHoldOrders] = useState<HoldOrder[]>([]);
  const [holdOrdersModalOpen, setHoldOrdersModalOpen] = useState(false);

  // Shift Management State
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [startShiftModalOpen, setStartShiftModalOpen] = useState<boolean>(false);
  const [closeShiftModalOpen, setCloseShiftModalOpen] = useState<boolean>(false);
  const [xReportModalOpen, setXReportModalOpen] = useState<boolean>(false);
  const [cashExpenseModalOpen, setCashExpenseModalOpen] = useState<boolean>(false);

  // Deteksi izin kas keluar kasir (Owner, Admin, Supervisor, atau Kasir dengan canCashOut = true)
  const activeUser = currentUser || authStorage.getUser();
  const canCashOut = Boolean(
    activeUser &&
    (['OWNER', 'ADMIN', 'SUPERVISOR'].includes(activeUser.role) || activeUser.canCashOut === true)
  );

  // Payment & Checkout State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Initial Data Fetch
  const loadProducts = async (targetOutletId?: string) => {
    try {
      setLoading(true);
      const outletIdToUse = targetOutletId || activeOutlet?.id;
      const [prodRes, catRes] = await Promise.all([
        api.getProducts({ outletId: outletIdToUse }),
        api.getCategories(outletIdToUse, 'true', true),
      ]);

      if (prodRes.status === 'success' && prodRes.data) {
        setProducts(prodRes.data);
      }
      if (catRes.status === 'success' && catRes.data) {
        setCategories(catRes.data);
      }
    } catch (err) {
      console.error('Gagal memuat produk & kategori:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentShift = async () => {
    try {
      const res = await api.getCurrentShift();
      if (res.status === 'success') {
        setCurrentShift(res.data);
      } else {
        setCurrentShift(null);
      }
    } catch (err) {
      console.error('Gagal memuat status shift:', err);
      setCurrentShift(null);
    }
  };

  const loadHoldOrders = async (targetOutletId?: string) => {
    try {
      const res = await api.getHoldOrders(targetOutletId || activeOutlet?.id);
      if (res.status === 'success' && res.data) {
        setHoldOrders(res.data);
      }
    } catch (err) {
      console.error('Gagal memuat hold orders:', err);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await customerApi.getCustomers({ limit: 100 });
      if (res.status === 'success' && res.data) {
        setCustomers(res.data);
      }
    } catch (err) {
      console.error('Gagal memuat data pelanggan CRM:', err);
    }
  };

  useEffect(() => {
    loadProducts(activeOutlet?.id);
    loadCurrentShift();
    loadHoldOrders(activeOutlet?.id);
    loadCustomers();
  }, [activeOutlet?.id]);

  // Barcode Scanner Listener Buffer
  const barcodeBuffer = useRef<string>('');
  const lastKeyTime = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Hotkeys: F2 (Cari), F8 (X-Report), F9 (Close Shift), F4 (Bayar)
      if (e.key === 'F4' && cart.length > 0 && !paymentModalOpen) {
        e.preventDefault();
        setPaymentModalOpen(true);
        return;
      }
      if (e.key === 'F8' && currentShift && !xReportModalOpen) {
        e.preventDefault();
        setXReportModalOpen(true);
        return;
      }
      if (e.key === 'F9' && currentShift && !closeShiftModalOpen) {
        e.preventDefault();
        setCloseShiftModalOpen(true);
        return;
      }

      // Barcode Scanner detection
      const now = Date.now();
      if (now - lastKeyTime.current > 100) {
        barcodeBuffer.current = '';
      }
      lastKeyTime.current = now;

      if (e.key === 'Enter') {
        if (barcodeBuffer.current.length >= 3) {
          const scanned = barcodeBuffer.current.trim();
          handleScanBarcode(scanned);
          barcodeBuffer.current = '';
        }
      } else if (e.key.length === 1) {
        barcodeBuffer.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, currentShift, products, paymentModalOpen, xReportModalOpen, closeShiftModalOpen]);

  const handleScanBarcode = (code: string) => {
    const found = products.find(
      (p) =>
        p.barcode.toLowerCase() === code.toLowerCase() ||
        p.sku.toLowerCase() === code.toLowerCase()
    );
    if (found) {
      handleProductSelect(found);
      setScanMessage(`Scan berhasil: ${found.name}`);
      setTimeout(() => setScanMessage(null), 2500);
    } else {
      setScanMessage(`Produk barcode "${code}" tidak ditemukan`);
      setTimeout(() => setScanMessage(null), 3000);
    }
  };

  // Add Product to Cart
  const addToCart = (product: Product) => {
    if (!currentShift) {
      setScanMessage('⚠️ Shift kasir belum dibuka! Buka shift kasir terlebih dahulu untuk mulai transaksi.');
      setStartShiftModalOpen(true);
      return;
    }

    const isComposite = product.productType === 'COMPOSITE' || product.hasStock === false;
    const stock = product.stock ?? 0;
    const isUnlimited = isComposite || stock >= 99999;
    if (!isUnlimited && stock <= 0) {
      dialog.alert({
        title: 'Stok Produk Habis',
        message: `Stok "${product.name}" saat ini habis (0)!`,
        variant: 'warning',
      });
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id && !item.cartItemId);
      if (existing) {
        if (!isUnlimited && existing.quantity >= stock) {
          dialog.alert({
            title: 'Batas Stok Tercapai',
            message: `Jumlah melebihi stok yang tersedia (${stock} ${product.unit})!`,
            variant: 'warning',
          });
          return prev;
        }
        return prev.map((item) =>
          item.product.id === product.id && !item.cartItemId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prev, { product, quantity: 1, discountAmount: 0 }];
      }
    });
  };

  const handleProductSelect = (product: Product) => {
    if (!currentShift) {
      setScanMessage('⚠️ Shift kasir belum dibuka! Buka shift kasir terlebih dahulu untuk mulai transaksi.');
      setStartShiftModalOpen(true);
      return;
    }

    const isComposite = product.productType === 'COMPOSITE' || product.hasStock === false;
    const stock = product.stock ?? 0;
    const isUnlimited = isComposite || stock >= 99999;
    if (!isUnlimited && stock <= 0) {
      dialog.alert({
        title: 'Stok Produk Habis',
        message: `Stok "${product.name}" saat ini habis (0)!`,
        variant: 'warning',
      });
      return;
    }

    if (product.modifiers && product.modifiers.length > 0) {
      setSelectedProductForModifier(product);
      setModifierModalOpen(true);
    } else {
      addToCart(product);
    }
  };

  const handleConfirmModifier = (payload: {
    product: Product;
    selectedOptions: { groupName: string; option: any }[];
    note: string;
    finalPrice: number;
  }) => {
    const { product, selectedOptions, note, finalPrice } = payload;
    const cartItemId = `${product.id}_${Date.now()}`;
    setCart((prev) => [
      ...prev,
      {
        cartItemId,
        product,
        quantity: 1,
        discountAmount: 0,
        selectedModifiers: selectedOptions,
        itemNote: note,
        customPrice: finalPrice,
      },
    ]);
    setModifierModalOpen(false);
    setSelectedProductForModifier(null);
  };

  const handleUpdateQuantity = (index: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      const item = updated[index];
      if (!item) return prev;

      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        updated.splice(index, 1);
      } else {
        const stock = item.product.stock ?? 0;
        const isUnlimited = stock >= 99999;
        if (!isUnlimited && newQty > stock) {
          dialog.alert({
            title: 'Batas Stok Tercapai',
            message: `Jumlah pesanan melebihi stok tersedia (${stock} ${item.product.unit})!`,
            variant: 'warning',
          });
          return prev;
        }
        updated[index] = { ...item, quantity: newQty };
      }
      return updated;
    });
  };

  const handleRemoveItem = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  // ─── Reset Penuh Satu Transaksi (dipakai di: Hold Order, Bayar, Lepas Tagihan, Batal Tarik) ───
  const resetTransactionState = () => {
    setCart([]);
    setTableNumber('');
    setCustomerName('');
    setCustomerPhone('');
    setSelectedCustomer(null);
    setGlobalDiscount(0);
    setAppliedPromotion(null);
    setOnDemandQuantities({});
    setActivePulledOrder(null);
    setActiveOpenTab(null);
    setOnlineOrderId('');
    setScanMessage(null);
    onClearAppendOrder?.();
  };

  const handleClearCart = async () => {
    if (cart.length === 0) return;
    const ok = await dialog.confirm({
      title: 'Kosongkan Keranjang',
      message: 'Apakah Anda yakin ingin mengosongkan semua pesanan di keranjang belanja?',
      variant: 'warning',
      confirmText: 'Ya, Kosongkan',
      cancelText: 'Batal',
    });
    if (ok) {
      resetTransactionState();
    }
  };

  // Hold Order Execution
  const handleHoldOrder = async () => {
    if (!currentShift) {
      setScanMessage('⚠️ Shift kasir belum dibuka! Silakan buka shift kasir terlebih dahulu.');
      setStartShiftModalOpen(true);
      return;
    }
    if (cart.length === 0) return;
    if (isFree) {
      triggerProUpgrade('Tahan Antrean Pesanan (Hold Order)');
      return;
    }

    try {
      const totalAmount = cart.reduce((acc, item) => {
        const price = item.customPrice || item.product.price || item.product.basePrice || 0;
        return acc + price * item.quantity;
      }, 0);

      const payload = {
        outletId: activeOutlet?.id,
        customerName: customerName.trim() || undefined,
        channel: orderChannel,
        items: cart.map((i) => ({
          productId: i.product.id,
          name: i.product.name,
          quantity: i.quantity,
          unitPrice: i.customPrice || i.product.price || i.product.basePrice || 0,
          discountAmount: i.discountAmount || 0,
        })),
        totalAmount,
      };

      const res = await api.holdOrder(payload);
      if (res.status === 'success') {
        resetTransactionState();
        loadHoldOrders(activeOutlet?.id);
        dialog.toast('Pesanan berhasil ditahan di daftar antrean.', 'success');
      } else {
        dialog.alert({
          title: 'Gagal Menahan Pesanan',
          message: res.message || 'Gagal menahan pesanan.',
          variant: 'danger',
        });
      }
    } catch (err: any) {
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: err.message || 'Terjadi kesalahan sistem saat menahan pesanan.',
        variant: 'danger',
      });
    }
  };

  const handleResumeHoldOrder = async (hold: HoldOrder) => {
    if (cart.length > 0) {
      const ok = await dialog.confirm({
        title: 'Gantikan Keranjang Aktif',
        message: 'Keranjang saat ini berisi produk. Lanjutkan dan ganti dengan pesanan tertahan ini?',
        variant: 'warning',
        confirmText: 'Lanjutkan',
        cancelText: 'Batal',
      });
      if (!ok) return;
    }

    if (hold.channel) {
      setOrderChannel(hold.channel as OrderChannel);
    }

    const restoredCart: CartItem[] = [];
    for (const item of hold.items || []) {
      const found = products.find((p) => p.id === item.productId);
      if (found) {
        restoredCart.push({
          product: found,
          quantity: item.quantity,
          discountAmount: item.discountAmount || 0,
        });
      }
    }

    setCart(restoredCart);
    setCustomerName(hold.customerName || '');
    try {
      await api.deleteHoldOrder(hold.id);
    } catch (e) {
      console.error('Gagal menghapus hold order setelah resume:', e);
    }
    loadHoldOrders(activeOutlet?.id);
  };

  const handleDeleteHoldOrder = async (id: string) => {
    const ok = await dialog.confirm({
      title: 'Batalkan Pesanan Tertahan',
      message: 'Batalkan dan hapus antrean pesanan tertahan ini?',
      variant: 'danger',
      confirmText: 'Ya, Batalkan',
      cancelText: 'Kembali',
    });
    if (!ok) return;
    try {
      const res = await api.deleteHoldOrder(id);
      if (res.status === 'success') {
        loadHoldOrders(activeOutlet?.id);
      }
    } catch (err) {
      console.error('Gagal menghapus hold order:', err);
    }
  };

  // Batal Tarik / Kembalikan Pesanan ke Antrean Semula
  const handleCancelPulledOrder = () => {
    const tbl = activePulledOrder?.tableNumber || tableNumber;
    const inv = activePulledOrder?.invoiceNumber;
    setCart([]);
    setCustomerName('');
    setCustomerPhone('');
    setTableNumber('');
    setOnlineOrderId('');
    setSelectedCustomer(null);
    setGlobalDiscount(0);
    setOnDemandQuantities({});
    setActivePulledOrder(null);
    setActiveOpenTab(null);
    setScanMessage(`Pesanan Meja ${tbl || ''} ${inv ? `(#${inv})` : ''} telah dikembalikan ke antrean.`);
  };

  // Quick Action untuk membuka tagihan dari pemilih meja
  const handleSelectOccupiedTable = (orderId: string, type: 'OPEN_TAB' | 'QR_ORDER') => {
    if (type === 'OPEN_TAB') {
      const found = openTabs.find((t) => t.id === orderId);
      if (found) handlePullOpenTab(found);
    } else {
      const found = qrOrders.find((q) => q.id === orderId);
      if (found) handlePullQrOrder(found);
    }
  };

  // Open Tab Management (Simpan / Perbarui Tagihan Meja)
  const handleSaveOpenTab = async () => {
    if (!currentShift) {
      setScanMessage('⚠️ Shift kasir belum dibuka! Silakan buka shift kasir terlebih dahulu.');
      setStartShiftModalOpen(true);
      return;
    }
    if (cart.length === 0) {
      setScanMessage('Keranjang belanja masih kosong!');
      return;
    }
    if (!tableNumber && !customerName.trim()) {
      setScanMessage('⚠️ Mohon pilih/isi Nomor Meja atau Nama Pelanggan sebelum menyimpan tagihan meja!');
      return;
    }

    try {
      setCheckoutLoading(true);
      const subtotal = cart.reduce((acc, item) => {
        const price = item.customPrice || item.product.price || item.product.basePrice || 0;
        return acc + price * item.quantity;
      }, 0);

      let promoDisc = 0;
      if (appliedPromotion) {
        if (appliedPromotion.discountType === 'PERCENTAGE') {
          promoDisc = Math.round((subtotal * appliedPromotion.discountValue) / 100);
          if (appliedPromotion.maxDiscountAmount && Number(appliedPromotion.maxDiscountAmount) > 0) {
            promoDisc = Math.min(promoDisc, Number(appliedPromotion.maxDiscountAmount));
          }
        } else {
          promoDisc = Math.min(subtotal, Number(appliedPromotion.discountValue));
        }
      }
      const totalDiscount = Math.round((subtotal * globalDiscount) / 100) + promoDisc;
      const discountedSubtotal = Math.max(0, subtotal - totalDiscount);
      const targetExistingOrderId = activePulledOrder?.id || activeOpenTab?.id || null;
      const targetChannel = activePulledOrder?.channel || orderChannel;

      // Hitung rincian pajak (PB1) & biaya layanan (service charge + kemasan) untuk tagihan meja
      let openTabTaxAmount = 0;
      let openTabServiceCharge = 0;
      outletFees
        .filter((f) => {
          if (!f.isActive || f.category === 'ON_DEMAND_PACKAGING') return false;
          if (!f.channelScope || f.channelScope === 'ALL') return true;
          if (f.channelScope === targetChannel) return true;
          if (
            f.channelScope === 'ONLINE_DELIVERY' &&
            ['GOFOOD', 'GRABFOOD', 'SHOPEEFOOD'].includes(targetChannel)
          ) {
            return true;
          }
          return false;
        })
        .forEach((fee) => {
          const val =
            fee.type === 'PERCENTAGE'
              ? Math.round((discountedSubtotal * fee.rate) / 100)
              : fee.rate;
          const isSvc =
            fee.id === 'fee_service' ||
            fee.name.toLowerCase().includes('layanan') ||
            fee.name.toLowerCase().includes('service');
          if (isSvc) {
            openTabServiceCharge += val;
          } else {
            openTabTaxAmount += val;
          }
        });
      openTabServiceCharge += onDemandFeesTotal;

      const payload: OpenTabPayload = {
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          discountAmount: i.discountAmount,
          notes: i.itemNote,
        })),
        channel: targetChannel,
        tableNumber: tableNumber ? tableNumber.trim() : undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        customerId: selectedCustomer?.id || undefined,
        discountAmount: totalDiscount,
        taxAmount: openTabTaxAmount,
        serviceCharge: openTabServiceCharge,
        outletId: activeOutlet?.id,
        shiftId: currentShift.id,
        existingOrderId: targetExistingOrderId,
      };

      const res = await api.createOpenTab(payload);
      if (res.status === 'success' && res.data) {
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setTableNumber('');
        setOnlineOrderId('');
        setSelectedCustomer(null);
        setGlobalDiscount(0);
        setAppliedPromotion(null);
        setOnDemandQuantities({});
        setActivePulledOrder(null);
        setActiveOpenTab(null);
        loadTablesAndOrders();
        setScanMessage(
          res.message ||
            (targetExistingOrderId
              ? `Tagihan Meja ${tableNumber || ''} berhasil diperbarui.`
              : `Tagihan Meja ${tableNumber || ''} berhasil disimpan & dikirim ke dapur.`)
        );
      } else {
        setScanMessage(`⚠️ ${res.message || 'Gagal menyimpan tagihan meja'}`);
      }
    } catch (err: any) {
      setScanMessage(`⚠️ ${err.message || 'Terjadi kesalahan sistem saat menyimpan tagihan meja'}`);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handlePullOpenTab = (tab: OpenTabOrder, openPaymentImmediately = false) => {
    const newCartItems: CartItem[] = [];
    (tab.items || []).forEach((item) => {
      if (!item || !item.productName) return;
      const matched = products.find(
        (p) =>
          (item.productId && p.id === item.productId) ||
          (p.name && item.productName && p.name.toLowerCase() === item.productName.toLowerCase())
      );
      if (matched) {
        newCartItems.push({
          cartItemId: `item_tab_${item.id || Date.now()}_${Math.random()}`,
          product: matched,
          quantity: item.quantity || 1,
          discountAmount: item.discountAmount || 0,
          itemNote: item.notes || (item.variantName ? `Varian: ${item.variantName}` : undefined),
          customPrice: Number(item.unitPrice) || matched.price || matched.basePrice,
        });
      } else {
        newCartItems.push({
          cartItemId: `item_tab_${item.id || Date.now()}_${Math.random()}`,
          product: {
            id: item.productId || item.id || `tab_${Date.now()}`,
            name: item.productName,
            basePrice: Number(item.unitPrice) || 0,
            price: Number(item.unitPrice) || 0,
            costPrice: 0,
            unit: 'Pcs',
            stock: 999,
            minStockAlert: 0,
            isActive: true,
            barcode: '',
            sku: '',
            category: { id: 'default', name: 'Menu Dine In' },
          },
          quantity: item.quantity || 1,
          discountAmount: item.discountAmount || 0,
          itemNote: item.notes || item.variantName || undefined,
          customPrice: Number(item.unitPrice) || 0,
        });
      }
    });

    setCart(newCartItems);
    setCustomerName(tab.customerName || (tab.tableNumber ? `Pelanggan Meja ${tab.tableNumber}` : ''));
    setCustomerPhone(tab.customerPhone || '');
    setTableNumber(tab.tableNumber || '');
    setOrderChannel('DINE_IN');
    setActivePulledOrder({
      id: tab.id,
      invoiceNumber: tab.invoiceNumber,
      tableNumber: tab.tableNumber || '',
      customerName: tab.customerName || '',
      customerPhone: tab.customerPhone || '',
      channel: tab.channel || 'DINE_IN',
      source: 'OPEN_TAB',
    });
    setActiveOpenTab(tab);
    setOpenTabsModalOpen(false);

    if (openPaymentImmediately) {
      setPaymentModalOpen(true);
    } else {
      setScanMessage(`Tagihan Meja ${tab.tableNumber || ''} (#${tab.invoiceNumber}) dimuat ke kasir.`);
    }
  };

  const handleCancelOpenTab = async (tabId: string) => {
    try {
      const res = await api.cancelOpenTab(tabId, 'Dibatalkan oleh kasir');
      if (res.status === 'success') {
        if (activeOutlet?.id) loadOpenTabs(activeOutlet.id);
        if (activeOpenTab?.id === tabId || activePulledOrder?.id === tabId) {
          setActivePulledOrder(null);
          setActiveOpenTab(null);
          setCart([]);
          setCustomerName('');
          setTableNumber('');
        }
        setScanMessage('Tagihan meja berhasil dibatalkan.');
      } else {
        dialog.alert({
          title: 'Gagal Membatalkan',
          message: res.message || 'Gagal membatalkan tagihan meja.',
          variant: 'danger',
        });
      }
    } catch (err: any) {
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: err.message || 'Gagal membatalkan tagihan meja.',
        variant: 'danger',
      });
    }
  };

  const handleSplitBill = () => {
    if (isFree) {
      triggerProUpgrade('Bagi Tagihan (Split Bill)');
      return;
    }
    setPaymentModalOpen(true);
  };

  // Checkout Execution
  const handleExecuteCheckout = async (payment: PaymentPayload, payments?: PaymentPayload[]) => {
    setCheckoutLoading(true);
    try {
      const subtotal = cart.reduce((acc, item) => {
        const price = item.customPrice || item.product.price || item.product.basePrice || 0;
        return acc + price * item.quantity;
      }, 0);

      let promoDisc = 0;
      if (appliedPromotion) {
        if (appliedPromotion.discountType === 'PERCENTAGE') {
          promoDisc = Math.round((subtotal * appliedPromotion.discountValue) / 100);
          if (appliedPromotion.maxDiscountAmount && Number(appliedPromotion.maxDiscountAmount) > 0) {
            promoDisc = Math.min(promoDisc, Number(appliedPromotion.maxDiscountAmount));
          }
        } else {
          promoDisc = Math.min(subtotal, Number(appliedPromotion.discountValue));
        }
      }
      const totalDiscount = Math.round((subtotal * globalDiscount) / 100) + promoDisc;
      const discountedSubtotal = Math.max(0, subtotal - totalDiscount);
      const targetChannel = activePulledOrder?.channel || orderChannel;

      // Hitung rincian pajak (PB1) & biaya layanan (service charge + kemasan) untuk disimpan di order
      let checkoutTaxAmount = 0;
      let checkoutServiceCharge = 0;
      outletFees
        .filter((f) => {
          if (!f.isActive || f.category === 'ON_DEMAND_PACKAGING') return false;
          if (!f.channelScope || f.channelScope === 'ALL') return true;
          if (f.channelScope === targetChannel) return true;
          if (
            f.channelScope === 'ONLINE_DELIVERY' &&
            ['GOFOOD', 'GRABFOOD', 'SHOPEEFOOD'].includes(targetChannel)
          ) {
            return true;
          }
          return false;
        })
        .forEach((fee) => {
          const val =
            fee.type === 'PERCENTAGE'
              ? Math.round((discountedSubtotal * fee.rate) / 100)
              : fee.rate;
          const isSvc =
            fee.id === 'fee_service' ||
            fee.name.toLowerCase().includes('layanan') ||
            fee.name.toLowerCase().includes('service');
          if (isSvc) {
            checkoutServiceCharge += val;
          } else {
            checkoutTaxAmount += val;
          }
        });
      checkoutServiceCharge += onDemandFeesTotal;

      const targetOrderId = activePulledOrder?.id || activeOpenTab?.id || undefined;

      const res = await api.checkoutOrder({
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          discountAmount: i.discountAmount,
        })),
        channel: targetChannel,
        tableNumber: tableNumber ? tableNumber.trim() : undefined,
        onlineOrderId: onlineOrderId ? onlineOrderId.trim() : undefined,
        customerId: selectedCustomer?.id || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        discountAmount: totalDiscount,
        taxAmount: checkoutTaxAmount,
        serviceCharge: checkoutServiceCharge,
        promotionId: appliedPromotion?.id || undefined,
        outletId: activeOutlet?.id,
        existingOrderId: targetOrderId,
        payment,
        payments: payments && payments.length > 0 ? payments : undefined,
      });

      if (res.status === 'success' && res.data) {
        setLastOrder(res.data);
        setPaymentModalOpen(false);
        setSuccessModalOpen(true);
        resetTransactionState();
        loadProducts(activeOutlet?.id);
        loadCurrentShift();
        loadTablesAndOrders();
      } else {
        dialog.alert({
          title: 'Transaksi Gagal',
          message: res.message || 'Transaksi gagal diproses.',
          variant: 'danger',
        });
      }
    } catch (err: any) {
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: err.message || 'Terjadi kesalahan sistem saat checkout.',
        variant: 'danger',
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Filter Catalog
  const filteredProducts = products.filter((p) => {
    const matchCategory = selectedCategory === 'all' || p.category?.id === selectedCategory;
    const matchSearch =
      searchBarcode.trim() === '' ||
      p.name.toLowerCase().includes(searchBarcode.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchBarcode)) ||
      (p.sku && p.sku.toLowerCase().includes(searchBarcode.toLowerCase()));
    return matchCategory && matchSearch;
  });

  // Calculate Grand Total for Payment Modal
  const cartSubtotal = cart.reduce((acc, item) => {
    const price = item.customPrice || item.product.price || item.product.basePrice || 0;
    return acc + price * item.quantity;
  }, 0);
  const cartDiscount = Math.round((cartSubtotal * globalDiscount) / 100);

  let promoDiscount = 0;
  if (appliedPromotion) {
    if (appliedPromotion.discountType === 'PERCENTAGE') {
      promoDiscount = Math.round((cartSubtotal * appliedPromotion.discountValue) / 100);
      if (appliedPromotion.maxDiscountAmount && Number(appliedPromotion.maxDiscountAmount) > 0) {
        promoDiscount = Math.min(promoDiscount, Number(appliedPromotion.maxDiscountAmount));
      }
    } else {
      promoDiscount = Math.min(cartSubtotal, Number(appliedPromotion.discountValue));
    }
  }

  const cartAfterDiscount = Math.max(0, cartSubtotal - (cartDiscount + promoDiscount));

  let onDemandFeesTotal = 0;
  outletFees
    .filter((f) => f.category === 'ON_DEMAND_PACKAGING')
    .forEach((f) => {
      const qty = onDemandQuantities[f.id] || 0;
      onDemandFeesTotal += (f.rate || 0) * qty;
    });

  let autoFeesTotal = 0;
  outletFees
    .filter((f) => {
      if (!f.isActive || f.category === 'ON_DEMAND_PACKAGING') return false;
      if (!f.channelScope || f.channelScope === 'ALL') return true;
      if (f.channelScope === orderChannel) return true;
      if (
        f.channelScope === 'ONLINE_DELIVERY' &&
        (orderChannel === 'GOFOOD' || orderChannel === 'GRABFOOD' || orderChannel === 'SHOPEEFOOD')
      ) {
        return true;
      }
      return false;
    })
    .forEach((fee) => {
      if (fee.type === 'PERCENTAGE') {
        autoFeesTotal += Math.round((cartAfterDiscount * fee.rate) / 100);
      } else {
        autoFeesTotal += fee.rate;
      }
    });

  const cartGrandTotal = cartAfterDiscount + onDemandFeesTotal + autoFeesTotal;

  return (
    <div className={`flex flex-col ${isHandheld ? 'h-[100dvh] md:h-[calc(100vh-6.5rem)]' : 'h-[calc(100vh-6.5rem)]'} overflow-hidden bg-slate-100 font-sans`}>
      {isHandheld ? (
        <PosMobileView
          activeOutlet={activeOutlet}
          currentShift={currentShift}
          currentUserRole={currentUserRole}
          canCashOut={canCashOut}
          orderChannel={orderChannel}
          onChangeOrderChannel={(ch) => setOrderChannel(ch)}
          tableNumber={tableNumber}
          onChangeTableNumber={(t) => setTableNumber(t)}
          tables={tables}
          customerName={customerName}
          onChangeCustomerName={(name) => setCustomerName(name)}
          customerPhone={customerPhone}
          onChangeCustomerPhone={(phone) => setCustomerPhone(phone)}
          selectedCustomer={selectedCustomer}
          onSelectCustomer={(cust) => setSelectedCustomer(cust)}
          customers={customers}
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={(catId) => setSelectedCategory(catId)}
          searchQuery={searchBarcode}
          onSearchChange={(q) => setSearchBarcode(q)}
          products={products}
          filteredProducts={filteredProducts}
          loading={loading}
          onSelectProduct={handleProductSelect}
          cart={cart}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onClearCart={handleClearCart}
          subtotal={cartSubtotal}
          discountAmount={cartDiscount + promoDiscount}
          taxAmount={autoFeesTotal}
          serviceChargeAmount={0}
          cartGrandTotal={cartGrandTotal}
          onOpenPayment={() => setPaymentModalOpen(true)}
          onSaveOpenTab={handleSaveOpenTab}
          onHoldOrder={handleHoldOrder}
          holdOrdersCount={holdOrders.length}
          onOpenHeldOrders={() => setHoldOrdersModalOpen(true)}
          openTabsCount={openTabs.length}
          onOpenOpenTabs={() => setOpenTabsModalOpen(true)}
          qrOrdersCount={unpaidQrOrders.length}
          onOpenQrOrders={() => setQrOrdersModalOpen(true)}
          onOpenStartShift={() => setStartShiftModalOpen(true)}
          onOpenCloseShift={() => setCloseShiftModalOpen(true)}
          onOpenXReport={() => setXReportModalOpen(true)}
          onOpenCashExpense={canCashOut ? () => setCashExpenseModalOpen(true) : undefined}
          onToggleDesktopMode={() => setHandheldModeOverride(false)}
          appliedPromotion={appliedPromotion}
          onOpenVoucherPicker={() => setVoucherModalOpen(true)}
          onRemovePromotion={() => {
            setAppliedPromotion(null);
            setScanMessage('Kupon promo telah dilepas.');
          }}
          globalDiscount={globalDiscount}
          onChangeGlobalDiscount={(disc) => setGlobalDiscount(disc)}
          activeFees={outletFees}
          onDemandQuantities={onDemandQuantities}
          onOpenOnDemandPicker={() => {
            refreshOutletFees(true);
            setOnDemandPickerOpen(true);
          }}
          onNavigateTab={onNavigateTab}
          onLogout={onLogout}
          allowedTabs={allowedTabs}
          currentUser={currentUser}
        />
      ) : (
        <>
          {/* 1. Header Bar: Outlet, Shift, Actions */}
          <PosHeader
            activeOutlet={activeOutlet}
            currentShift={currentShift}
            orderChannel={orderChannel}
            onChangeOrderChannel={(ch) => setOrderChannel(ch)}
            heldOrdersCount={holdOrders.length}
            onOpenHeldOrders={() => setHoldOrdersModalOpen(true)}
            openTabsCount={openTabs.length}
            onOpenOpenTabs={() => setOpenTabsModalOpen(true)}
            qrOrdersCount={unpaidQrOrders.length}
            onOpenQrOrders={() => setQrOrdersModalOpen(true)}
            onOpenStartShift={() => setStartShiftModalOpen(true)}
            onOpenCloseShift={() => setCloseShiftModalOpen(true)}
            onOpenXReport={() => setXReportModalOpen(true)}
            onOpenCashExpense={canCashOut ? () => setCashExpenseModalOpen(true) : undefined}
            onOpenSupervisorFees={() => {
              setSupervisorInitialTab('TAX');
              setSupervisorFeesModalOpen(true);
            }}
            currentUserRole={currentUserRole}
            channelsConfig={activeOutlet?.channelsConfig || undefined}
            onToggleHandheldMode={() => setHandheldModeOverride(true)}
          />

          {/* 2. Main Workspace: Split Catalog Grid & Order Cart */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Left Column: Category Pills, Search & Product Catalog */}
            <div className="flex-1 flex flex-col p-3 sm:p-4 overflow-hidden gap-3">
              <CategoryFilterPills
                categories={categories}
                selectedCategory={selectedCategory}
                onSelectCategory={(catId) => setSelectedCategory(catId)}
                searchQuery={searchBarcode}
                onSearchChange={(q) => setSearchBarcode(q)}
                onSearchSubmit={() => {
                  if (filteredProducts.length === 1) {
                    handleProductSelect(filteredProducts[0]);
                    setSearchBarcode('');
                  }
                }}
                viewMode={viewMode}
                onToggleViewMode={(mode) => setViewMode(mode)}
                scanMessage={scanMessage}
                onClearScanMessage={() => setScanMessage(null)}
              />

              <ProductCatalogGrid
                products={filteredProducts}
                onSelectProduct={handleProductSelect}
                viewMode={viewMode}
                loading={loading}
              />
            </div>

            {/* Right Column: Order Cart Sidebar */}
            <OrderCartSidebar
              cart={cart}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveItem}
              onClearCart={handleClearCart}
              orderChannel={orderChannel}
              tableNumber={tableNumber}
              onChangeTableNumber={(t) => setTableNumber(t)}
              onlineOrderId={onlineOrderId}
              onChangeOnlineOrderId={(id) => setOnlineOrderId(id)}
              availableTables={tables}
              customerName={customerName}
              onChangeCustomerName={(name) => setCustomerName(name)}
              customerPhone={customerPhone}
              onChangeCustomerPhone={(phone) => setCustomerPhone(phone)}
              selectedCustomer={selectedCustomer}
              onSelectCustomer={(cust) => setSelectedCustomer(cust)}
              customers={customers}
              globalDiscount={globalDiscount}
              onChangeGlobalDiscount={(disc) => setGlobalDiscount(disc)}
              activeFees={outletFees}
              onDemandQuantities={onDemandQuantities}
              onOpenOnDemandPicker={() => {
                refreshOutletFees(true);
                setOnDemandPickerOpen(true);
              }}
              onHoldOrder={handleHoldOrder}
              onSplitBill={handleSplitBill}
              onOpenPayment={() => setPaymentModalOpen(true)}
              disabledPayment={cart.length === 0 || !currentShift}
              currentShift={currentShift}
              onOpenStartShift={() => setStartShiftModalOpen(true)}
              onSaveOpenTab={handleSaveOpenTab}
              activeOpenTab={activeOpenTab}
              onClearOpenTab={() => {
                setActivePulledOrder(null);
                setActiveOpenTab(null);
                setCart([]);
                setCustomerName('');
                setCustomerPhone('');
                setTableNumber('');
                setScanMessage(null);
              }}
              activePulledOrder={activePulledOrder}
              onCancelPulledOrder={handleCancelPulledOrder}
              occupiedTablesMap={occupiedTablesMap}
              onSelectOccupiedTable={handleSelectOccupiedTable}
              appliedPromotion={appliedPromotion}
              onOpenPromotionModal={() => setVoucherModalOpen(true)}
              onRemovePromotion={() => {
                setAppliedPromotion(null);
                setScanMessage('Kupon promo telah dilepas.');
              }}
            />
          </div>
        </>
      )}

      {/* =========================================================================
          MODALS & DIALOGS
      ========================================================================= */}
      {/* Hold Orders Modal */}
      <HoldOrdersModal
        isOpen={holdOrdersModalOpen}
        onClose={() => setHoldOrdersModalOpen(false)}
        heldOrders={holdOrders}
        onResumeOrder={handleResumeHoldOrder}
        onDeleteHeldOrder={handleDeleteHoldOrder}
      />

      {/* Open Tabs (Tagihan Meja Terbuka) Modal */}
      <OpenTabsModal
        isOpen={openTabsModalOpen}
        onClose={() => setOpenTabsModalOpen(false)}
        openTabs={openTabs}
        onPullOpenTab={handlePullOpenTab}
        onCancelOpenTab={handleCancelOpenTab}
      />

      {/* Payment Sheet Modal */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        grandTotal={cartGrandTotal}
        onCheckout={handleExecuteCheckout}
        loading={checkoutLoading}
        outlet={activeOutlet}
      />

      {/* Order Success & Thermal Receipt Modal */}
      {lastOrder && (
        <OrderSuccessModal
          isOpen={successModalOpen}
          onClose={() => {
            setSuccessModalOpen(false);
            setLastOrder(null);
          }}
          order={lastOrder}
        />
      )}

      {/* Shift Management Modals */}
      <StartShiftModal
        isOpen={startShiftModalOpen}
        onClose={() => setStartShiftModalOpen(false)}
        onShiftStarted={(newShift) => {
          setCurrentShift(newShift);
          setStartShiftModalOpen(false);
        }}
      />

      {currentShift && (
        <>
          <CloseShiftModal
            isOpen={closeShiftModalOpen}
            onClose={() => setCloseShiftModalOpen(false)}
            currentShift={currentShift}
            onShiftClosed={() => {
              setCurrentShift(null);
              setCloseShiftModalOpen(false);
            }}
          />
          <XReportModal
            isOpen={xReportModalOpen}
            onClose={() => setXReportModalOpen(false)}
          />
          <CashExpenseModal
            isOpen={cashExpenseModalOpen}
            onClose={() => setCashExpenseModalOpen(false)}
            currentShift={currentShift}
            onExpenseRecorded={() => {
              loadCurrentShift();
            }}
          />
        </>
      )}

      {/* Modifiers Selection Modal */}
      <ProductModifierModal
        isOpen={modifierModalOpen}
        onClose={() => {
          setModifierModalOpen(false);
          setSelectedProductForModifier(null);
        }}
        product={selectedProductForModifier}
        onConfirm={handleConfirmModifier}
      />

      {/* Supervisor Fees & Packaging Modals */}
      {activeOutlet && (
        <SupervisorFeesModal
          isOpen={supervisorFeesModalOpen}
          onClose={() => setSupervisorFeesModalOpen(false)}
          outlet={activeOutlet}
          currentUserRole={currentUserRole}
          initialTab={supervisorInitialTab}
          onSaved={(updatedFees) => {
            setOutletFees(updatedFees);
            onOutletFeesUpdated?.(updatedFees);
            if (supervisorInitialTab === 'PACKAGING') {
              setTimeout(() => {
                setOnDemandPickerOpen(true);
              }, 400);
            }
          }}
        />
      )}

      <OnDemandFeesPickerModal
        isOpen={onDemandPickerOpen}
        onClose={() => setOnDemandPickerOpen(false)}
        onDemandFees={outletFees.filter((f) => f.category === 'ON_DEMAND_PACKAGING')}
        currentQuantities={onDemandQuantities}
        onConfirm={(newQuantities) => {
          setOnDemandQuantities(newQuantities);
          setOnDemandPickerOpen(false);
        }}
        onOpenManageFees={() => {
          setSupervisorInitialTab('PACKAGING');
          setOnDemandPickerOpen(false);
          setSupervisorFeesModalOpen(true);
        }}
        onRefresh={() => refreshOutletFees(false)}
        isRefreshing={isRefreshingFees}
      />

      {/* Modal Daftar Pesanan Meja QR (Kitchen & Pull to Cashier) */}
      {qrOrdersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-900 text-white flex items-center justify-center shadow-xs">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-blue-950 text-base">
                    Pesanan Masuk dari Meja QR
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tarik pesanan meja pelanggan untuk proses pembayaran di kasir
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQrOrdersModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-3">
              {unpaidQrOrders.length === 0 ? (
                <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 space-y-2">
                  <QrCode className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-sm font-bold text-slate-600">
                    Tidak ada pesanan meja QR yang menunggu pembayaran
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Seluruh pesanan meja telah lunas dibayar atau belum ada pelanggan yang memesan lewat QR Meja.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {unpaidQrOrders.map((order) => (
                    <div
                      key={order.id}
                      className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-blue-900 text-white text-xs font-black tracking-wide">
                            MEJA {order.tableNumber}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {order.customerName || 'Tamu Pelanggan'}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            #{order.invoiceNumber}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600">
                          {order.items.map((i, idx) => (
                            <span key={idx} className="mr-2">
                              {i.quantity}x {i.productName}
                              {idx < order.items.length - 1 ? ',' : ''}
                            </span>
                          ))}
                        </div>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(order.createdAt).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <span className="font-bold text-blue-950">
                            Total: {formatRupiah(order.grandTotal)}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePullQrOrder(order)}
                        className="px-4 py-2.5 rounded-xl bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                      >
                        <span>Tarik ke Kasir</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Voucher Selection Modal */}
      <VoucherSelectionModal
        isOpen={voucherModalOpen}
        onClose={() => setVoucherModalOpen(false)}
        subtotal={cartSubtotal}
        appliedPromotion={appliedPromotion}
        onApplyPromotion={(promo) => {
          setAppliedPromotion(promo);
          setScanMessage(`Kupon ${promo.code} berhasil diterapkan.`);
        }}
        onRemovePromotion={() => {
          setAppliedPromotion(null);
          setScanMessage('Kupon telah dilepas.');
        }}
      />

      {/* Split Bill Modal */}
      <SplitBillModal
        isOpen={splitBillModalOpen}
        onClose={() => setSplitBillModalOpen(false)}
        cart={cart}
        grandTotal={cartGrandTotal}
        onProceedPayment={() => {
          setPaymentModalOpen(true);
        }}
      />

      {/* Pro Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        featureHighlight={upgradeFeatureHighlight}
        message={upgradeMessage}
      />
    </div>
  );
};

export default PosTerminalView;
