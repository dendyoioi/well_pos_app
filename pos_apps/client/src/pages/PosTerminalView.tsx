import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { QrCode, ArrowRight, X, Clock, UtensilsCrossed, WifiOff, CloudUpload, RefreshCw } from 'lucide-react';
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
  BarcodeCameraScannerModal,
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
import { KitchenTicketModal, buildKitchenTicketData } from '../components/KitchenTicketModal';
import type { KitchenTicketData } from '../components/KitchenTicketModal';
import { StaffAttendanceModal } from '../components/pos/StaffAttendanceModal';
import { usePlan } from '../hooks/usePlan';
import { useDialog } from '../context/DialogContext';
import { api, customerApi, authStorage, attendanceApi } from '../services/api';
import type { User } from '../types/auth';
import {
  saveOfflineOrder,
  getPendingOfflineOrders,
  getOfflineQueueCount,
  markOfflineOrderSyncing,
  markOfflineOrderSuccess,
  markOfflineOrderFailed,
  clearSyncedOfflineOrders,
} from '../utils/offlineQueue';

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
  const [staffAttendanceModalOpen, setStaffAttendanceModalOpen] = useState(false);

  // 100% Otomatis Sync Timezone Outlet (Zero Configuration WIB / WITA / WIT)
  useEffect(() => {
    if (activeOutlet?.id) {
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
      } catch {
        // Abaikan jika lingkungan browser tidak mendukung resolvedOptions
      }
    }
  }, [activeOutlet?.id, activeOutlet?.timezone]);

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
  const [cameraScannerOpen, setCameraScannerOpen] = useState<boolean>(false);

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

  const handlePullAppendOrder = (order: Order) => {
    const newCartItems: CartItem[] = [];
    (order.orderItems || []).forEach((item) => {
      if (!item) return;
      const pName = item.product?.name || '';
      const matched = products.find(
        (p) =>
          (item.productId && p.id === item.productId) ||
          (p.name && pName && p.name.toLowerCase() === pName.toLowerCase())
      );
      if (matched) {
        newCartItems.push({
          cartItemId: `item_append_${item.id || Date.now()}_${Math.random()}`,
          product: matched,
          quantity: item.quantity || 1,
          discountAmount: item.discountAmount || 0,
          customPrice: Number(item.unitPrice) || matched.price || matched.basePrice,
        });
      } else {
        newCartItems.push({
          cartItemId: `item_append_${item.id || Date.now()}_${Math.random()}`,
          product: {
            id: item.productId || item.id || `append_${Date.now()}`,
            name: pName || 'Menu Dine In',
            basePrice: Number(item.unitPrice) || 0,
            price: Number(item.unitPrice) || 0,
            costPrice: Number(item.costPrice) || 0,
            unit: item.product?.unit || 'Pcs',
            stock: 999,
            minStockAlert: 0,
            isActive: true,
            barcode: item.product?.barcode || '',
            sku: item.product?.sku || '',
            category: { id: 'default', name: 'Menu Dine In' },
          },
          quantity: item.quantity || 1,
          discountAmount: item.discountAmount || 0,
          customPrice: Number(item.unitPrice) || 0,
        });
      }
    });

    setCart(newCartItems);
    setCustomerName(order.customerName || (order.tableNumber ? `Pelanggan Meja ${order.tableNumber}` : ''));
    setCustomerPhone(order.customerPhone || '');
    setTableNumber(order.tableNumber || '');
    setOrderChannel('DINE_IN');
    setActivePulledOrder({
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      tableNumber: order.tableNumber || '',
      customerName: order.customerName || '',
      customerPhone: order.customerPhone || '',
      channel: (order.channel as OrderChannel) || 'DINE_IN',
      source: 'OPEN_TAB',
    });
    setActiveOpenTab({
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      queueNumber: order.queueNumber,
      outletId: order.outletId,
      cashierId: order.cashierId,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      channel: order.channel || 'DINE_IN',
      tableNumber: order.tableNumber,
      notes: order.notes,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      taxAmount: order.taxAmount,
      serviceCharge: order.serviceCharge,
      grandTotal: order.grandTotal,
      orderStatus: order.orderStatus || 'PENDING',
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      items: (order.orderItems || []).map((it) => ({
        id: it.id,
        productId: it.productId,
        productName: it.product?.name || 'Produk',
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        discountAmount: it.discountAmount,
        subtotal: it.subtotal,
        notes: undefined,
      })),
    });
    setScanMessage(`Tagihan Meja ${order.tableNumber || ''} (#${order.invoiceNumber}) dimuat ke kasir untuk penambahan pesanan.`);
  };

  useEffect(() => {
    if (appendOrderData) {
      if (appendOrderData.paymentStatus === 'UNPAID') {
        handlePullAppendOrder(appendOrderData);
      }
      onClearAppendOrder?.();
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
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Offline-First PWA Sync State
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(0);
  const [isSyncingQueue, setIsSyncingQueue] = useState<boolean>(false);

  const refreshOfflineQueueCount = useCallback(async () => {
    try {
      const stats = await getOfflineQueueCount(activeOutlet?.id);
      setPendingOfflineCount(stats.pending);
    } catch {
      // Ignored
    }
  }, [activeOutlet?.id]);

  // Kitchen Ticket (KDS) Modal State
  const [kitchenTicketOpen, setKitchenTicketOpen] = useState(false);
  const [kitchenTicketData, setKitchenTicketData] = useState<KitchenTicketData | null>(null);

  /** Buka kitchen ticket preview/print dengan data dari cart aktif saat ini */
  const handleOpenKitchenTicket = useCallback((opts?: { isAddOn?: boolean; invoiceNumber?: string }) => {
    if (cart.length === 0) return;
    const ticketData = buildKitchenTicketData({
      cart,
      tableNumber: tableNumber || undefined,
      customerName: customerName || undefined,
      invoiceNumber: opts?.invoiceNumber || activePulledOrder?.invoiceNumber || undefined,
      outletName: activeOutlet?.name || undefined,
      cashierName: activeUser?.name || undefined,
      isAddOn: opts?.isAddOn || false,
    });
    setKitchenTicketData(ticketData);
    setKitchenTicketOpen(true);
  }, [cart, tableNumber, customerName, activePulledOrder, activeOutlet, activeUser]);

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

  // Helper: play beep sound via Web Audio API
  const playBeep = useCallback((success: boolean) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      const now = ctx.currentTime;
      if (success) {
        // Beep naik = scan sukses (440 Hz → 880 Hz)
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.linearRampToValueAtTime(880, now + 0.08);
        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      } else {
        // Beep turun = scan gagal (400 Hz → 200 Hz)
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(200, now + 0.12);
        gain.gain.setValueAtTime(0.07, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      }
      osc.connect(gain);
      gain.connect(ctx.destination);
    } catch (_) {
      // Silent fallback jika browser membatasi autoplay
    }
  }, []);

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

      // ─── Global Barcode Scanner (Keyboard Wedge Listener) ───────────────────
      // SKIP jika fokus ada di elemen input/textarea/select agar tidak konflik
      // dengan pengetikan kasir di form field manapun.
      const activeEl = document.activeElement;
      const isTypingField =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement;
      if (isTypingField) return;

      // Barcode Scanner detection: keystroke interval < 50ms = scanner hardware
      const now = Date.now();
      if (now - lastKeyTime.current > 100) {
        // Reset buffer jika jeda antar keystroke > 100ms (ketikan manual manusia)
        barcodeBuffer.current = '';
      }
      lastKeyTime.current = now;

      if (e.key === 'Enter') {
        // Scanner hardware mengirimkan Enter sebagai terminator
        // Min 4 karakter untuk mengurangi false-positive
        if (barcodeBuffer.current.length >= 4) {
          const scanned = barcodeBuffer.current.trim();
          handleScanBarcode(scanned);
          barcodeBuffer.current = '';
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeBuffer.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, currentShift, products, paymentModalOpen, xReportModalOpen, closeShiftModalOpen]);

  // Handler Sinkronisasi Antrean Offline PWA
  const handleSyncOfflineQueue = useCallback(async () => {
    if (isSyncingQueue || !navigator.onLine) return;
    setIsSyncingQueue(true);
    try {
      const pendingOrders = await getPendingOfflineOrders(activeOutlet?.id);
      if (pendingOrders.length === 0) {
        await refreshOfflineQueueCount();
        setIsSyncingQueue(false);
        return;
      }

      let successCount = 0;
      let failCount = 0;

      for (const offlineOrder of pendingOrders) {
        try {
          await markOfflineOrderSyncing(offlineOrder.offlineId);
          const res = await api.checkoutOrder(offlineOrder.payload);
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
        dialog.toast(`${successCount} transaksi offline berhasil disinkronkan ke server.`, 'success');
        if (activeOutlet?.id) {
          loadProducts(activeOutlet.id);
        }
        loadCurrentShift();
        loadTablesAndOrders();
      }
      if (failCount > 0) {
        dialog.toast(`${failCount} transaksi offline belum berhasil disinkronkan. Akan dicoba kembali otomatis.`, 'error');
      }
    } catch (err: any) {
      console.error('Error saat menyinkronkan antrean offline:', err);
    } finally {
      setIsSyncingQueue(false);
    }
  }, [isSyncingQueue, activeOutlet?.id, dialog, loadProducts, loadCurrentShift, loadTablesAndOrders, refreshOfflineQueueCount]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refreshOfflineQueueCount();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    refreshOfflineQueueCount();

    const syncInterval = setInterval(() => {
      if (navigator.onLine) {
        getOfflineQueueCount(activeOutlet?.id).then((stats) => {
          setPendingOfflineCount(stats.pending);
          if (stats.pending > 0 && !isSyncingQueue) {
            handleSyncOfflineQueue();
          }
        });
      }
    }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(syncInterval);
    };
  }, [activeOutlet?.id, handleSyncOfflineQueue, isSyncingQueue, refreshOfflineQueueCount]);

  const handleScanBarcode = (code: string): { success: boolean; productName?: string } => {
    const cleanCode = code.trim().toLowerCase();
    const found = products.find(
      (p) =>
        (p.barcode && p.barcode.toLowerCase() === cleanCode) ||
        (p.sku && p.sku.toLowerCase() === cleanCode) ||
        (p.modifiers && p.modifiers.some((m) =>
          m.options?.some((opt) => opt.name.toLowerCase() === cleanCode)
        ))
    );
    if (found) {
      handleProductSelect(found);
      playBeep(true);
      setScanMessage(`✅ Scan: ${found.name}`);
      setTimeout(() => setScanMessage(null), 2500);
      return { success: true, productName: found.name };
    } else {
      playBeep(false);
      setScanMessage(`❌ Barcode "${code}" tidak ditemukan di katalog`);
      setTimeout(() => setScanMessage(null), 3500);
      return { success: false };
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
    setPointsToRedeem(0);
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
      const payload = {
        outletId: activeOutlet?.id,
        customerName: customerName.trim() || undefined,
        channel: orderChannel,
        tableNumber: tableNumber ? tableNumber.trim() : undefined,
        items: cart.map((i) => ({
          productId: i.product.id,
          name: i.product.name,
          quantity: i.quantity,
          unitPrice: i.customPrice || i.product.price || i.product.basePrice || 0,
          discountAmount: i.discountAmount || 0,
          itemNote: i.itemNote,
          selectedModifiers: i.selectedModifiers,
        })),
        onDemandQuantities: Object.keys(onDemandQuantities).length > 0 ? onDemandQuantities : undefined,
        appliedPromotion: appliedPromotion || undefined,
        totalAmount: cartGrandTotal,
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
    if (hold.tableNumber) {
      setTableNumber(hold.tableNumber);
    }

    const rawItems = hold.items || hold.cartItems || [];
    const restoredCart: CartItem[] = [];
    for (const item of rawItems) {
      const found = products.find((p) => p.id === item.productId);
      if (found) {
        restoredCart.push({
          product: found,
          quantity: item.quantity,
          discountAmount: item.discountAmount || 0,
          itemNote: (item as any).itemNote || (item as any).note,
          selectedModifiers: (item as any).selectedModifiers,
        });
      } else {
        // Fallback: pulihkan item dari data snapshot agar item pelanggan tidak hilang jika sedang difilter
        restoredCart.push({
          product: {
            id: item.productId,
            name: item.name || 'Produk',
            price: item.unitPrice || 0,
            basePrice: item.unitPrice || 0,
            sku: '',
            category: 'Menu',
            stock: 9999,
          } as any,
          quantity: item.quantity,
          discountAmount: item.discountAmount || 0,
          itemNote: (item as any).itemNote || (item as any).note,
          selectedModifiers: (item as any).selectedModifiers,
        });
      }
    }

    setCart(restoredCart);
    setCustomerName(
      hold.customerName && !hold.customerName.startsWith('Antrean #') ? hold.customerName : ''
    );

    // Pulihkan pilihan kemasan on-demand jika tersimpan
    if (hold.onDemandQuantities && typeof hold.onDemandQuantities === 'object') {
      setOnDemandQuantities(hold.onDemandQuantities);
    } else {
      setOnDemandQuantities({});
    }

    // Pulihkan voucher promo jika tersimpan
    if (hold.appliedPromotion) {
      setAppliedPromotion(hold.appliedPromotion);
    } else {
      setAppliedPromotion(null);
    }

    try {
      await api.deleteHoldOrder(hold.id);
    } catch (e) {
      console.error('Gagal menghapus hold order setelah resume:', e);
    }
    loadHoldOrders(activeOutlet?.id);
    dialog.toast('Pesanan berhasil dipulihkan ke keranjang kasir.', 'success');
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
      const msg = 'Shift kasir belum dibuka! Silakan buka shift kasir terlebih dahulu.';
      setScanMessage(`⚠️ ${msg}`);
      dialog.alert({
        title: 'Shift Belum Dibuka',
        message: msg,
        variant: 'warning',
      });
      setStartShiftModalOpen(true);
      return;
    }
    if (cart.length === 0) {
      const msg = 'Keranjang belanja masih kosong!';
      setScanMessage(msg);
      dialog.toast(msg, 'error');
      return;
    }
    if (!tableNumber && !customerName.trim()) {
      const msg = 'Mohon pilih Nomor Meja atau isi Nama Pelanggan sebelum mengirim pesanan ke dapur.';
      setScanMessage(`⚠️ ${msg}`);
      dialog.alert({
        title: 'Pilih Meja / Nama Pelanggan',
        message: msg,
        variant: 'warning',
      });
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
        const successMsg =
          res.message ||
          (targetExistingOrderId
            ? `Tagihan Meja ${tableNumber || ''} berhasil diperbarui.`
            : `Tagihan Meja ${tableNumber || ''} berhasil disimpan & dikirim ke dapur.`);
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
        setScanMessage(successMsg);
        dialog.toast(successMsg, 'success');
      } else {
        const errorMsg = res.message || 'Gagal menyimpan tagihan meja';
        setScanMessage(`⚠️ ${errorMsg}`);
        dialog.alert({
          title: 'Gagal Mengirim ke Dapur',
          message: errorMsg,
          variant: 'danger',
        });
      }
    } catch (err: any) {
      const errorMsg = err.message || 'Terjadi kesalahan sistem saat menyimpan tagihan meja';
      setScanMessage(`⚠️ ${errorMsg}`);
      dialog.alert({
        title: 'Kesalahan Sistem',
        message: errorMsg,
        variant: 'danger',
      });
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
    setSplitBillModalOpen(true);
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
      const susulanNote = activeOpenTab?.notes || (activePulledOrder?.invoiceNumber ? `Ref Faktur #${activePulledOrder.invoiceNumber}` : undefined);
      const grandTotal = discountedSubtotal + checkoutTaxAmount + checkoutServiceCharge;

      const checkoutPayload = {
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          discountAmount: i.discountAmount,
        })),
        channel: targetChannel,
        tableNumber: tableNumber ? tableNumber.trim() : undefined,
        onlineOrderId: onlineOrderId ? onlineOrderId.trim() : undefined,
        notes: susulanNote,
        customerId: selectedCustomer?.id || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        discountAmount: totalDiscount,
        taxAmount: checkoutTaxAmount,
        serviceCharge: checkoutServiceCharge,
        promotionId: appliedPromotion?.id || undefined,
        pointsToRedeem: Boolean(activeOutlet?.loyaltyConfig?.isActive) && pointsToRedeem > 0 ? pointsToRedeem : undefined,
        outletId: activeOutlet?.id,
        existingOrderId: targetOrderId,
        payment,
        payments: payments && payments.length > 0 ? payments : undefined,
      };

      const allPayments: PaymentPayload[] = payments && payments.length > 0 ? payments : (payment ? [payment] : []);
      const requiresInternet = allPayments.some((p) => p.method === 'QRIS');

      if (!navigator.onLine && requiresInternet) {
        dialog.alert({
          title: 'Koneksi Offline',
          message: 'Pembayaran QRIS memerlukan koneksi internet aktif untuk verifikasi gateway. Silakan gunakan metode pembayaran Tunai (Cash) saat offline.',
          variant: 'warning',
        });
        setCheckoutLoading(false);
        return;
      }

      const completeOfflineOrder = async () => {
        const offlineRefId = `OFFLINE-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const randomSeq = Math.floor(1000 + Math.random() * 9000);
        const tempInvoice = `INV/OFFLINE/${yyyy}${mm}${dd}/${randomSeq}`;

        const tempOrderData: Order = {
          id: offlineRefId,
          invoiceNumber: tempInvoice,
          channel: targetChannel as any,
          orderType: targetChannel as any,
          tableNumber: tableNumber ? tableNumber.trim() : null,
          subtotal,
          totalAmount: subtotal,
          grandTotal,
          discountAmount: totalDiscount,
          taxAmount: checkoutTaxAmount,
          serviceCharge: checkoutServiceCharge,
          paymentStatus: 'PAID',
          status: 'PAID',
          cashierId: activeUser?.id || '',
          notes: susulanNote ? `${susulanNote} [OFFLINE]` : '[OFFLINE]',
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          outletId: activeOutlet?.id || '',
          outlet: activeOutlet
            ? {
                name: activeOutlet.name,
                address: activeOutlet.address || null,
                phone: activeOutlet.phone || null,
                receiptConfig: (activeOutlet as any).receiptConfig,
              }
            : undefined,
          cashier: {
            name: activeUser?.name || 'Kasir',
          },
          user: {
            id: activeUser?.id || '',
            name: activeUser?.name || 'Kasir',
            role: (currentUserRole || 'CASHIER') as any,
          },
          orderItems: cart.map((i, idx) => {
            const unitPrice = i.customPrice || i.product.price || i.product.basePrice || 0;
            return {
              id: `item-${offlineRefId}-${idx}`,
              productId: i.product.id,
              quantity: i.quantity,
              unitPrice,
              subtotal: (unitPrice - (i.discountAmount || 0)) * i.quantity,
              discountAmount: i.discountAmount || 0,
              costPrice: Number(i.product.costPrice || 0),
              product: {
                name: i.product.name,
                sku: i.product.sku,
                barcode: i.product.barcode,
                unit: i.product.unit || 'Pcs',
              },
            };
          }),
          payments: allPayments.map((p, pIdx) => ({
            id: `pay-${offlineRefId}-${pIdx}`,
            method: p.method,
            paymentMethod: p.method,
            amountPaid: p.amountPaid,
            amount: p.amountPaid,
            changeGiven: p.changeGiven || 0,
            qrisReference: p.qrisReference || null,
            status: 'CAPTURED',
            createdAt: now.toISOString(),
          })),
        };

        await saveOfflineOrder({
          offlineId: offlineRefId,
          createdAt: now.toISOString(),
          outletId: activeOutlet?.id,
          shiftId: currentShift?.id,
          cashierName: activeUser?.name || 'Kasir',
          payload: {
            ...checkoutPayload,
            offlineReferenceId: offlineRefId,
          },
          tempOrder: tempOrderData,
          status: 'PENDING',
          retryCount: 0,
        });

        setLastOrder(tempOrderData);
        setPaymentModalOpen(false);
        setSuccessModalOpen(true);
        resetTransactionState();
        await refreshOfflineQueueCount();

        dialog.toast(
          `Faktur #${tempInvoice} tersimpan di antrean offline. Struk siap dicetak!`,
          'info'
        );
      };

      if (!navigator.onLine) {
        await completeOfflineOrder();
        return;
      }

      try {
        const res = await api.checkoutOrder(checkoutPayload);

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
      } catch (networkErr: any) {
        const isNetworkFailure =
          !navigator.onLine ||
          networkErr?.name === 'TypeError' ||
          String(networkErr?.message || '').toLowerCase().includes('fetch') ||
          String(networkErr?.message || '').toLowerCase().includes('network');

        if (isNetworkFailure && !requiresInternet) {
          await completeOfflineOrder();
        } else {
          dialog.alert({
            title: 'Kesalahan Sistem',
            message: networkErr.message || 'Terjadi kesalahan sistem saat checkout.',
            variant: 'danger',
          });
        }
      }
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

  // Program Loyalitas & Poin Per-Outlet
  const isLoyaltyActive = Boolean(activeOutlet?.loyaltyConfig?.isActive);
  const pointValueIdr = activeOutlet?.loyaltyConfig?.pointValueIdr || 100;
  const pointDiscountAmount =
    isLoyaltyActive && pointsToRedeem > 0 ? pointsToRedeem * pointValueIdr : 0;

  const cartGrandTotal = Math.max(
    0,
    cartAfterDiscount + onDemandFeesTotal + autoFeesTotal - pointDiscountAmount
  );

  return (
    <div className={`flex flex-col ${isHandheld ? 'h-[100dvh] md:h-[calc(100vh-6.5rem)]' : 'h-[calc(100vh-6.5rem)]'} overflow-hidden bg-slate-100 font-sans`}>
      {isHandheld ? (
        <PosMobileView
          activeOutlet={activeOutlet}
          pointsToRedeem={pointsToRedeem}
          onChangePointsToRedeem={(pts) => setPointsToRedeem(pts)}
          currentShift={currentShift}
          currentUserRole={currentUserRole}
          canCashOut={canCashOut}
          orderChannel={orderChannel}
          onChangeOrderChannel={(ch) => setOrderChannel(ch)}
          onlineOrderId={onlineOrderId}
          onChangeOnlineOrderId={(id) => setOnlineOrderId(id)}
          channelsConfig={activeOutlet?.channelsConfig || undefined}
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
          onOpenBarcodeScanner={() => setCameraScannerOpen(true)}
          isOnline={isOnline}
          pendingOfflineCount={pendingOfflineCount}
          isSyncingQueue={isSyncingQueue}
          onSyncOfflineQueue={handleSyncOfflineQueue}
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
            onOpenAttendance={() => setStaffAttendanceModalOpen(true)}
          />

          {/* Banner Status Offline / Antrean Offline PWA (Desktop/Tablet) */}
          {(!isOnline || pendingOfflineCount > 0) && (
            <div
              className={`px-4 py-2.5 border-b flex items-center justify-between gap-3 text-xs shrink-0 transition-colors ${
                !isOnline
                  ? 'bg-rose-50 border-rose-200 text-rose-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                {!isOnline ? (
                  <WifiOff className="w-4 h-4 text-rose-600 shrink-0 animate-pulse" />
                ) : (
                  <CloudUpload className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <div className="truncate">
                  <span className="font-extrabold">
                    {!isOnline ? 'Koneksi Terputus (Mode Kasir Offline Aktif)' : 'Penyelarasan Data Lokal PWA'}
                  </span>
                  <span className="ml-2 font-medium">
                    {!isOnline
                      ? 'Kasir tetap dapat memproses pembayaran Tunai dan mencetak struk fisik lokal.'
                      : `${pendingOfflineCount} transaksi offline tersimpan di perangkat ini.`}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {pendingOfflineCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full font-bold text-[11px] bg-amber-200 text-amber-900">
                    {pendingOfflineCount} antrean offline
                  </span>
                )}
                {isOnline && pendingOfflineCount > 0 && (
                  <button
                    type="button"
                    onClick={handleSyncOfflineQueue}
                    disabled={isSyncingQueue}
                    className="px-3 py-1 bg-blue-900 hover:bg-blue-800 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingQueue ? 'animate-spin' : ''}`} />
                    {isSyncingQueue ? 'Menyinkronkan...' : 'Sinkronkan Sekarang'}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Banner Mode Pesanan Susulan */}
          {appendOrderData && (
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-2 text-amber-900 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-4 h-4 text-amber-700 shrink-0" />
                <div>
                  <span className="font-extrabold">Mode Menu Tambahan / Susulan:</span> Menambahkan menu ke Faktur{' '}
                  <span className="font-mono font-black text-amber-950">#{appendOrderData.invoiceNumber}</span>
                  {appendOrderData.tableNumber && (
                    <span className="ml-1 font-bold">({`Meja ${appendOrderData.tableNumber}`})</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClearAppendOrder?.();
                  resetTransactionState();
                }}
                className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
              >
                Batalkan Susulan
              </button>
            </div>
          )}

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
                onOpenBarcodeScanner={() => setCameraScannerOpen(true)}
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
              outlet={activeOutlet}
              pointsToRedeem={pointsToRedeem}
              onChangePointsToRedeem={(pts) => setPointsToRedeem(pts)}
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
              onPrintKitchenTicket={handleOpenKitchenTicket}
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
        selectedCustomer={selectedCustomer}
        customerName={customerName}
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

      {/* Kitchen Ticket (KDS) Modal */}
      <KitchenTicketModal
        isOpen={kitchenTicketOpen}
        onClose={() => setKitchenTicketOpen(false)}
        data={kitchenTicketData}
      />

      {/* Pro Upgrade Modal */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        featureHighlight={upgradeFeatureHighlight}
        message={upgradeMessage}
      />

      {/* Live Camera Barcode Scanner Modal (EPIC-26) */}
      <BarcodeCameraScannerModal
        isOpen={cameraScannerOpen}
        onClose={() => setCameraScannerOpen(false)}
        onScan={handleScanBarcode}
      />

      {/* Modal Absensi Staf & Jam Kerja (Fase 3) */}
      <StaffAttendanceModal
        isOpen={staffAttendanceModalOpen}
        onClose={() => setStaffAttendanceModalOpen(false)}
        activeOutlet={activeOutlet}
      />
    </div>
  );
};

export default PosTerminalView;
