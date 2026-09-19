import React, { useState, useEffect, useRef } from 'react';
import {
  Barcode,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Receipt,
  Package,
  Tag,
  User,
  X,
  PercentCircle,
  Clock,
  Lock,
  FileText,
  PauseCircle,
  Bookmark,
  Phone,
  Split,
  UserCheck,
  Search,
  Users,
  LayoutGrid,
  List,
  Shield,
} from 'lucide-react';
import type { Product, Category } from '../types/product';
import type { CartItem, PaymentPayload, Order, HoldOrder, OrderChannel } from '../types/order';
import { ORDER_CHANNEL_LABELS } from '../types/order';
import type { Shift } from '../types/shift';
import type { Customer } from '../types/customer';
import type { Outlet, OutletFee, FeeCategory } from '../types/outlet';
import { PaymentModal } from '../components/PaymentModal';
import { OrderSuccessModal } from '../components/OrderSuccessModal';
import { StartShiftModal } from '../components/StartShiftModal';
import { XReportModal } from '../components/XReportModal';
import { CloseShiftModal } from '../components/CloseShiftModal';
import { UpgradeModal } from '../components/UpgradeModal';
import { SupervisorFeesModal } from '../components/SupervisorFeesModal';
import { OnDemandFeesPickerModal } from '../components/OnDemandFeesPickerModal';
import { ProductModifierModal } from '../components/ProductModifierModal';
import { usePlan } from '../hooks/usePlan';
import { api, customerApi } from '../services/api';

interface PosTerminalViewProps {
  activeOutlet?: Outlet | null;
  currentUserRole?: string;
  onOutletFeesUpdated?: (fees: OutletFee[]) => void;
  appendOrderData?: Order | null;
  onClearAppendOrder?: () => void;
}

export const PosTerminalView: React.FC<PosTerminalViewProps> = ({
  activeOutlet,
  currentUserRole,
  onOutletFeesUpdated,
  appendOrderData,
  onClearAppendOrder,
}) => {
  const { isFree } = usePlan();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState('Fitur Split Bill & Tahan Antrean tersedia di Paket Pro. Upgrade sekarang untuk mengaktifkan!');
  const [upgradeFeatureHighlight, setUpgradeFeatureHighlight] = useState('Split Bill & Tahan Antrean');

  const triggerProUpgrade = (featureName: string) => {
    setUpgradeFeatureHighlight(featureName);
    setUpgradeMessage(`Fitur ${featureName} tersedia di Paket Pro. Upgrade sekarang untuk mengaktifkan!`);
    setUpgradeModalOpen(true);
  };

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter & Barcode State
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchBarcode, setSearchBarcode] = useState('');
  const [scanMessage, setScanMessage] = useState<string | null>(null);

  // View Mode: 'grid' (Foto Produk) vs 'compact' (List Barcode Retail)
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');

  // Order Channel State (Multi-Channel Saluran Penjualan)
  const [orderChannel, setOrderChannel] = useState<OrderChannel>('DINE_IN');

  // Cart State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);

  // Modifiers Selection State for Fast Cashier Popup
  const [modifierModalOpen, setModifierModalOpen] = useState(false);
  const [selectedProductForModifier, setSelectedProductForModifier] = useState<Product | null>(null);

  // Kemasan & Biaya On-Demand ({ [feeId]: qty })
  const [onDemandQuantities, setOnDemandQuantities] = useState<Record<string, number>>({});
  const [onDemandPickerOpen, setOnDemandPickerOpen] = useState<boolean>(false);

  // Append order state (dari order sebelumnya)
  const [currentAppendingOrder, setCurrentAppendingOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (appendOrderData) {
      setCurrentAppendingOrder(appendOrderData);
      setCustomerName(`${appendOrderData.customerName || 'Pelanggan'} (Susulan #${appendOrderData.invoiceNumber})`);
      if (appendOrderData.channel) {
        setOrderChannel(appendOrderData.channel as OrderChannel);
      }
    }
  }, [appendOrderData]);

  // Dynamic Outlet Fees & Taxes (Dikelola & di-toggle oleh Supervisor)
  const [supervisorFeesModalOpen, setSupervisorFeesModalOpen] = useState<boolean>(false);
  const [outletFees, setOutletFees] = useState<OutletFee[]>([]);

  useEffect(() => {
    if (activeOutlet?.feesConfig && Array.isArray(activeOutlet.feesConfig) && activeOutlet.feesConfig.length > 0) {
      const mapped = activeOutlet.feesConfig.map((f) => {
        if (!f.category) {
          const isPackaging =
            f.id === 'fee_box' ||
            f.id.includes('plastic') ||
            f.name.toLowerCase().includes('kemasan') ||
            f.name.toLowerCase().includes('plastik') ||
            f.name.toLowerCase().includes('kantong');
          return {
            ...f,
            category: (isPackaging ? 'ON_DEMAND_PACKAGING' : 'DEFAULT_TAX_SERVICE') as FeeCategory,
            isQuickAccess: f.isQuickAccess ?? isPackaging,
          };
        }
        return f;
      });
      setOutletFees(mapped);
    } else {
      setOutletFees([
        {
          id: 'fee_tax',
          name: 'PPN / PB1 Pajak',
          type: 'PERCENTAGE',
          rate: 10,
          channelScope: 'ALL',
          isActive: true,
          category: 'DEFAULT_TAX_SERVICE',
        },
        {
          id: 'fee_service',
          name: 'Biaya Layanan Toko',
          type: 'PERCENTAGE',
          rate: 5,
          channelScope: 'DINE_IN',
          isActive: true,
          category: 'DEFAULT_TAX_SERVICE',
        },
        {
          id: 'fee_plastic',
          name: 'Kantong Plastik / Kresek',
          type: 'FIXED',
          rate: 500,
          channelScope: 'ALL',
          isActive: true,
          category: 'ON_DEMAND_PACKAGING',
          isQuickAccess: true,
        },
        {
          id: 'fee_box',
          name: 'Biaya Kemasan Box & Paperbag',
          type: 'FIXED',
          rate: 2000,
          channelScope: 'ALL',
          isActive: true,
          category: 'ON_DEMAND_PACKAGING',
          isQuickAccess: true,
        },
      ]);
    }
  }, [activeOutlet]);

  // Customer / Member CRM State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [memberPickerOpen, setMemberPickerOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberList, setMemberList] = useState<Customer[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddPhone, setQuickAddPhone] = useState('');
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  // Hold Order State
  const [holdOrders, setHoldOrders] = useState<HoldOrder[]>([]);
  const [holdOrderModalOpen, setHoldOrderModalOpen] = useState(false);
  const [viewHoldOrdersModalOpen, setViewHoldOrdersModalOpen] = useState(false);
  const [holdCustomerName, setHoldCustomerName] = useState('');
  const [holdNote, setHoldNote] = useState('');

  // Modals
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Modal Diskon Per Item
  const [editingItemDiscount, setEditingItemDiscount] = useState<{
    productId: string;
    name: string;
    basePrice: number;
    currentDiscount: number;
  } | null>(null);
  const [tempItemDiscount, setTempItemDiscount] = useState<number>(0);

  // Modal Diskon Global
  const [globalDiscountModalOpen, setGlobalDiscountModalOpen] = useState<boolean>(false);
  const [tempGlobalDiscount, setTempGlobalDiscount] = useState<number>(0);

  // Shift Management State
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [startShiftModalOpen, setStartShiftModalOpen] = useState<boolean>(false);
  const [xReportModalOpen, setXReportModalOpen] = useState<boolean>(false);
  const [closeShiftModalOpen, setCloseShiftModalOpen] = useState<boolean>(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Load products & categories
  const loadProducts = async (targetOutletId?: string) => {
    setLoading(true);
    try {
      const [prodRes, catRes] = await Promise.all([
        api.getProducts({ outletId: targetOutletId || activeOutlet?.id }),
        api.getCategories(),
      ]);
      if (prodRes.status === 'success') setProducts(prodRes.data);
      if (catRes.status === 'success') setCategories(catRes.data);
    } catch (err) {
      console.error('Gagal memuat produk POS:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load current active shift
  const loadCurrentShift = async () => {
    try {
      const res = await api.getCurrentShift();
      if (res.status === 'success') {
        setCurrentShift(res.data);
      }
    } catch (err) {
      console.error('Gagal memuat shift aktif:', err);
    }
  };

  // Load Hold Orders
  const loadHoldOrders = async (targetOutletId?: string) => {
    try {
      const res = await api.getHoldOrders(targetOutletId || activeOutlet?.id);
      if (res.status === 'success' && res.data) {
        setHoldOrders(res.data);
      }
    } catch (err) {
      console.error('Gagal memuat daftar pesanan tertahan:', err);
    }
  };

  useEffect(() => {
    loadProducts(activeOutlet?.id);
    loadCurrentShift();
    loadHoldOrders(activeOutlet?.id);
  }, [activeOutlet?.id]);

  // Keyboard Shortcuts: F2 (Focus Barcode), F4 (Checkout), F8 (Tahan/Buka Pesanan), F9 (Tutup Shift)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        barcodeInputRef.current?.focus();
      } else if (e.key === 'F4') {
        e.preventDefault();
        if (cart.length > 0 && !paymentModalOpen && !successModalOpen) {
          setPaymentModalOpen(true);
        }
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (isFree) {
          triggerProUpgrade('Tahan Antrean (Hold Order)');
          return;
        }
        if (cart.length > 0) {
          setHoldCustomerName(customerName);
          setHoldNote('');
          setHoldOrderModalOpen(true);
        } else {
          setViewHoldOrdersModalOpen(true);
        }
      } else if (e.key === 'F9') {
        e.preventDefault();
        if (currentShift) {
          setCloseShiftModalOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart, paymentModalOpen, successModalOpen, currentShift, customerName]);

  const getItemKey = (item: CartItem) => item.cartItemId || item.product.id;

  // Add product to cart (direct / standard)
  const addToCart = (product: Product) => {
    const isUnlimited = product.stock >= 99999;
    if (!isUnlimited && product.stock <= 0) {
      alert(`Stok "${product.name}" saat ini habis (0)!`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id && !item.cartItemId);
      if (existing) {
        if (!isUnlimited && existing.quantity >= product.stock) {
          alert(`Jumlah melebihi stok yang tersedia (${product.stock} ${product.unit})!`);
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

  // Selector yang mengecek apakah produk memiliki custom modifiers
  const handleProductSelect = (product: Product) => {
    const isUnlimited = product.stock >= 99999;
    if (!isUnlimited && product.stock <= 0) {
      alert(`Stok "${product.name}" saat ini habis (0)!`);
      return;
    }

    if (product.modifiers && product.modifiers.length > 0) {
      setSelectedProductForModifier(product);
      setModifierModalOpen(true);
    } else {
      addToCart(product);
    }
  };

  // Konfirmasi varian rasa/topping dari ProductModifierModal
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
  };

  // Update item quantity
  const updateQuantity = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (getItemKey(item) === key) {
            const newQty = item.quantity + delta;
            if (newQty > item.product.stock) {
              alert(`Jumlah melebihi sisa stok (${item.product.stock})!`);
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  // Set discount per item
  const applyItemDiscount = (key: string, discount: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (getItemKey(item) === key) {
          const maxPrice = item.customPrice !== undefined ? item.customPrice : item.product.basePrice;
          return {
            ...item,
            discountAmount: Math.max(0, Math.min(discount, maxPrice)),
          };
        }
        return item;
      })
    );
    setEditingItemDiscount(null);
  };

  const removeFromCart = (key: string) => {
    setCart((prev) => prev.filter((item) => getItemKey(item) !== key));
  };

  // Global USB Barcode Scanner Listener
  // Menangkap keystrokes cepat (<120ms antar karakter) dari handheld scanner USB
  useEffect(() => {
    let buffer = '';
    let lastKeyTime = Date.now();

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Jangan intersep jika user sedang mengetik di input/textarea
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      const currentTime = Date.now();
      if (currentTime - lastKeyTime > 150) {
        buffer = '';
      }
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (buffer.length >= 3) {
          const barcode = buffer.trim().toLowerCase();
          const found = products.find(
            (p) =>
              p.barcode.toLowerCase() === barcode ||
              p.sku.toLowerCase() === barcode
          );
          if (found) {
            addToCart(found);
            setScanMessage(`✅ Barcode Scanner USB: ${found.name}`);
            setTimeout(() => setScanMessage(null), 2500);
          } else {
            setScanMessage(`❌ Barcode tidak dikenal: ${buffer}`);
            setTimeout(() => setScanMessage(null), 3000);
          }
          buffer = '';
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => window.removeEventListener('keydown', handleWindowKeyDown);
  }, [products]);

  // Handle Scan Barcode / Search submit via manual input
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchBarcode.trim()) return;

    const term = searchBarcode.trim().toLowerCase();
    const found = products.find(
      (p) =>
        p.barcode.toLowerCase() === term ||
        p.sku.toLowerCase() === term ||
        p.name.toLowerCase() === term
    );

    if (found) {
      addToCart(found);
      setScanMessage(`✅ Ditambahkan: ${found.name}`);
      setSearchBarcode('');
      setTimeout(() => setScanMessage(null), 2000);
    } else {
      setScanMessage(`❌ Produk tidak ditemukan (${searchBarcode})`);
      setTimeout(() => setScanMessage(null), 3000);
    }
  };

  // Pencarian & Manajemen Member Kasir
  const searchMembers = async (q: string) => {
    setLoadingMembers(true);
    try {
      const res = await customerApi.getCustomers({ search: q.trim() || undefined, limit: 20 });
      if (res.status === 'success') {
        setMemberList(res.data);
      }
    } catch (err) {
      console.error('Gagal mencari member:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (memberPickerOpen) {
      searchMembers(memberSearch);
    }
  }, [memberPickerOpen, memberSearch]);

  const handleSelectCustomer = (c: Customer) => {
    setSelectedCustomer(c);
    setCustomerName(c.name);
    setCustomerPhone(c.phone || '');
    setMemberPickerOpen(false);
  };

  const handleClearCustomer = () => {
    setSelectedCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
  };

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddName.trim()) return;
    setQuickAddSubmitting(true);
    try {
      const res = await customerApi.createCustomer({
        name: quickAddName.trim(),
        phone: quickAddPhone.trim() || undefined,
      });
      if (res.status === 'success' && res.data) {
        handleSelectCustomer(res.data);
        setShowQuickAdd(false);
        setQuickAddName('');
        setQuickAddPhone('');
      } else {
        alert(res.message || 'Gagal menambah member');
      }
    } catch (err: any) {
      alert(err.message || 'Gagal menambah member');
    } finally {
      setQuickAddSubmitting(false);
    }
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    if (window.confirm('Bersihkan seluruh isi keranjang belanja?')) {
      setCart([]);
      setGlobalDiscount(0);
      setCustomerName('');
      setCustomerPhone('');
      setSelectedCustomer(null);
      setOnDemandQuantities({});
      setCurrentAppendingOrder(null);
      onClearAppendOrder?.();
    }
  };

  // Kalkulasi Harga Keranjang
  const isCartEmpty = cart.length === 0;

  const subtotal = isCartEmpty
    ? 0
    : cart.reduce((acc, item) => {
        const unitPrice = item.customPrice !== undefined ? item.customPrice : item.product.basePrice;
        return acc + (unitPrice - item.discountAmount) * item.quantity;
      }, 0);

  const totalItemDiscount = isCartEmpty
    ? 0
    : cart.reduce((acc, item) => acc + item.discountAmount * item.quantity, 0);

  const discountedSubtotal = Math.max(0, subtotal - globalDiscount);

  // Daftar semua biaya kemasan & on-demand aktif
  const activeOnDemandFees = outletFees.filter(
    (f) =>
      f.isActive &&
      (f.category === 'ON_DEMAND_PACKAGING' ||
        f.id === 'fee_box' ||
        f.id.includes('plastic') ||
        f.name.toLowerCase().includes('kemasan') ||
        f.name.toLowerCase().includes('plastik'))
  );

  // Item on-demand yang ditandai akses cepat (maksimal 4 item)
  const quickAccessFees = activeOnDemandFees.filter((f) => f.isQuickAccess).slice(0, 4);
  const displayQuickFees = quickAccessFees.length > 0 ? quickAccessFees : activeOnDemandFees.slice(0, 4);

  // Total biaya tambahan kemasan on-demand
  const packagingCost = isCartEmpty
    ? 0
    : Object.entries(onDemandQuantities).reduce((sum, [feeId, qty]) => {
        if (qty <= 0) return sum;
        const fee = activeOnDemandFees.find((f) => f.id === feeId);
        if (!fee) return sum;
        return sum + fee.rate * qty;
      }, 0);

  const totalOnDemandItemsSelected = Object.values(onDemandQuantities).reduce(
    (sum, q) => sum + (q > 0 ? q : 0),
    0
  );

  const handleUpdateOnDemandQty = (feeId: string, delta: number) => {
    setOnDemandQuantities((prev) => {
      const current = prev[feeId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[feeId];
        return copy;
      }
      return { ...prev, [feeId]: next };
    });
  };

  // Filter biaya operasional default toko (Pajak PPN & Layanan Resto otomatis), pisahkan dari biaya kemasan on-demand
  const applicableFees = isCartEmpty
    ? []
    : outletFees.filter(
        (f) =>
          f.isActive &&
          f.category !== 'ON_DEMAND_PACKAGING' &&
          f.id !== 'fee_box' &&
          !f.id.includes('plastic') &&
          !f.name.toLowerCase().includes('kemasan') &&
          !f.name.toLowerCase().includes('plastik') &&
          (f.channelScope === 'ALL' || f.channelScope === orderChannel)
      );

  const feeBreakdown = applicableFees.map((f) => {
    const amount =
      f.type === 'PERCENTAGE'
        ? Math.round(discountedSubtotal * (f.rate / 100))
        : f.rate;
    return {
      ...f,
      calculatedAmount: amount,
    };
  });

  const mandatoryFeesAmount = feeBreakdown.reduce((sum, f) => sum + f.calculatedAmount, 0);
  const totalFeesAmount = isCartEmpty ? 0 : mandatoryFeesAmount + packagingCost;

  // Pisahkan pajak vs service untuk kompatibilitas pencatatan struk & backend
  const taxFeeItem = feeBreakdown.find(
    (f) =>
      f.id === 'fee_tax' ||
      f.name.toLowerCase().includes('pajak') ||
      f.name.toLowerCase().includes('ppn') ||
      f.name.toLowerCase().includes('pb1')
  );
  const nonTaxFees = feeBreakdown.filter((f) => f !== taxFeeItem);

  const taxAmount = taxFeeItem ? taxFeeItem.calculatedAmount : 0;
  const taxRate = taxFeeItem && taxFeeItem.type === 'PERCENTAGE' ? taxFeeItem.rate / 100 : 0;
  const serviceChargeAmount = (nonTaxFees.reduce((sum, f) => sum + f.calculatedAmount, 0)) + packagingCost;
  const grandTotal = isCartEmpty ? 0 : discountedSubtotal + totalFeesAmount;

  // Simpan Pesanan Tertahan (Hold Order)
  const handleSaveHoldOrder = async () => {
    if (cart.length === 0) return;
    try {
      const payload = {
        customerName: holdCustomerName.trim() || customerName.trim() || undefined,
        channel: orderChannel,
        note: holdNote.trim() || undefined,
        items: cart.map((i) => ({
          productId: i.product.id,
          name: i.product.name,
          quantity: i.quantity,
          unitPrice: i.product.basePrice,
          discountAmount: i.discountAmount || 0,
        })),
        totalAmount: grandTotal,
      };
      const res = await api.holdOrder(payload);
      if (res.status === 'success') {
        setHoldOrderModalOpen(false);
        setCart([]);
        setCustomerName('');
        setCustomerPhone('');
        setGlobalDiscount(0);
        loadHoldOrders();
      } else {
        alert(res.message || 'Gagal menahan pesanan');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem saat menahan pesanan');
    }
  };

  // Pulihkan Pesanan Tertahan (Restore Hold Order)
  const handleRestoreHoldOrder = async (hold: HoldOrder) => {
    if (cart.length > 0) {
      const ok = window.confirm(
        'Keranjang saat ini berisi produk. Lanjutkan dan ganti dengan pesanan tertahan ini?'
      );
      if (!ok) return;
    }

    if (hold.channel) {
      setOrderChannel(hold.channel as OrderChannel);
    }

    const restoredCart: CartItem[] = [];
    for (const item of hold.items) {
      const found = products.find((p) => p.id === item.productId);
      if (found) {
        restoredCart.push({
          product: found,
          quantity: item.quantity,
          discountAmount: item.discountAmount || 0,
        });
      } else {
        restoredCart.push({
          product: {
            id: item.productId,
            name: item.name,
            sku: '',
            barcode: '',
            costPrice: 0,
            basePrice: item.unitPrice,
            stock: 99,
            minStockAlert: 0,
            unit: 'pcs',
            isActive: true,
            category: { id: '', name: 'Umum' },
          },
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
      console.error('Gagal menghapus hold order setelah restore:', e);
    }
    loadHoldOrders();
    setViewHoldOrdersModalOpen(false);
  };

  // Hapus / Batalkan Pesanan Tertahan
  const handleDeleteHoldOrder = async (id: string) => {
    if (!window.confirm('Batalkan dan hapus antrean pesanan tertahan ini?')) return;
    try {
      const res = await api.deleteHoldOrder(id);
      if (res.status === 'success') {
        loadHoldOrders();
      }
    } catch (err) {
      console.error('Gagal menghapus hold order:', err);
    }
  };

  // Eksekusi Checkout ke Backend (Mendukung Split Payment)
  const handleExecuteCheckout = async (payment: PaymentPayload, payments?: PaymentPayload[]) => {
    setCheckoutLoading(true);
    try {
      const res = await api.checkoutOrder({
        items: cart.map((i) => ({
          productId: i.product.id,
          quantity: i.quantity,
          discountAmount: i.discountAmount,
        })),
        channel: orderChannel,
        customerId: selectedCustomer?.id || undefined,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        discountAmount: globalDiscount,
        serviceCharge: serviceChargeAmount,
        taxRate,
        taxAmount,
        outletId: activeOutlet?.id,
        payment,
        payments: payments && payments.length > 0 ? payments : undefined,
      });

      if (res.status === 'success' && res.data) {
        setLastOrder(res.data);
        setPaymentModalOpen(false);
        setSuccessModalOpen(true);
        setCart([]);
        setGlobalDiscount(0);
        setCustomerName('');
        setCustomerPhone('');
        setSelectedCustomer(null);
        setOnDemandQuantities({});
        setCurrentAppendingOrder(null);
        onClearAppendOrder?.();
        // Refresh katalog produk untuk update stok lokal & rekap shift kasir
        loadProducts();
        loadCurrentShift();
      } else {
        alert(res.message || 'Transaksi gagal diproses');
      }
    } catch (err: any) {
      alert(err.message || 'Terjadi kesalahan sistem saat checkout');
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Filter produk berdasarkan kategori & pencarian
  const filteredProducts = products.filter((p) => {
    const matchCategory = selectedCategory === 'all' || p.category.id === selectedCategory;
    const matchSearch =
      searchBarcode.trim() === '' ||
      p.name.toLowerCase().includes(searchBarcode.toLowerCase()) ||
      p.barcode.includes(searchBarcode) ||
      p.sku.toLowerCase().includes(searchBarcode.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* SHIFT CONTROL & STATUS BAR */}
      {currentShift ? (
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center border border-emerald-200">
              <Clock className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <h4 className="text-xs font-black text-slate-900 tracking-tight">
                  Shift Kasir Aktif
                </h4>
                <span className="text-[11px] text-slate-400 font-medium">
                  • Dibuka {new Date(currentShift.startTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                Modal Awal: <strong className="text-slate-800">Rp {Number(currentShift.startingCash).toLocaleString('id-ID')}</strong>
                {' • '}
                Estimasi di Laci: <strong className="text-blue-900 font-extrabold">Rp {(currentShift.stats?.expectedCash || Number(currentShift.startingCash)).toLocaleString('id-ID')}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button
              onClick={() => setXReportModalOpen(true)}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all"
              title="Laporan Berjalan Kasir (F8)"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Slip X-Report (F8)</span>
            </button>
            <button
              onClick={() => setCloseShiftModalOpen(true)}
              className="px-3.5 py-1.5 bg-blue-900 hover:bg-blue-950 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-xs transition-all"
              title="Tutup Shift & Z-Report (F9)"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Tutup Shift (F9)</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200/80 p-3.5 sm:p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-950">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-200">
              <Clock className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                Sesi Shift Kasir Belum Dibuka
              </h4>
              <p className="text-[11px] text-amber-800/90 mt-0.5">
                Buka shift kasir dengan modal awal di laci (*float*) untuk pelacakan transaksi akurat.
              </p>
            </div>
          </div>

          <button
            onClick={() => setStartShiftModalOpen(true)}
            className="px-4 py-2 bg-blue-900 hover:bg-blue-950 text-white font-black rounded-xl text-xs flex items-center gap-2 shadow-sm transition-all self-start sm:self-auto"
          >
            <Clock className="w-4 h-4 stroke-[2.5]" />
            <span>Buka Shift Kasir (F8)</span>
          </button>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* ==================================================== */}
        {/* SISI KIRI (60%): KATALOG, SEARCH, SCANNER            */}
        {/* ==================================================== */}
        <div className="w-full lg:w-3/5 space-y-4">
        {/* Barcode & Search Input Bar */}
        <form onSubmit={handleBarcodeSubmit} className="relative">
          <div className="relative flex items-center">
            <Barcode className="w-5 h-5 text-blue-900 absolute left-4 pointer-events-none" />
            <input
              ref={barcodeInputRef}
              type="text"
              value={searchBarcode}
              onChange={(e) => setSearchBarcode(e.target.value)}
              placeholder="Scan Barcode USB atau cari nama/SKU... (Tekan F2)"
              className="w-full bg-white border-2 border-slate-200 focus:border-blue-900 focus:ring-4 focus:ring-blue-900/10 rounded-2xl pl-12 pr-28 py-3.5 text-sm font-semibold shadow-xs transition-all outline-none"
            />
            <button
              type="submit"
              className="absolute right-2 px-4 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95"
            >
              Cari / Enter
            </button>
          </div>

          {/* Feedback Toast Barcode Scan */}
          {scanMessage && (
            <div
              className={`mt-2 p-2.5 rounded-xl text-xs font-bold animate-fadeIn flex items-center gap-2 ${
                scanMessage.startsWith('✅')
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              <span>{scanMessage}</span>
            </div>
          )}
        </form>

        {/* Category Pills Bar & View Mode Toggle */}
        <div className="flex items-center justify-between gap-2 pb-1">
          <div className="flex items-center gap-2 overflow-x-auto pr-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedCategory === 'all'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              Semua ({products.length})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  selectedCategory === cat.id
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* View Mode Toggle: Grid Foto vs List Kasir */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shrink-0 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              title="Tampilan Visual Grid (Foto Produk)"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'grid'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-blue-950 hover:bg-slate-50'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Grid Foto</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('compact')}
              title="Tampilan List Barcode Retail Cepat"
              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'compact'
                  ? 'bg-blue-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-blue-950 hover:bg-slate-50'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">List Kasir</span>
            </button>
          </div>
        </div>

        {/* Product Catalog Display (Visual Grid vs Compact List) */}
        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs font-semibold">Memuat katalog produk...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-16 text-center text-slate-400 bg-white rounded-3xl border border-slate-200">
            <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-sm text-slate-700">Tidak ada produk yang cocok</p>
            <p className="text-xs text-slate-400">Periksa barcode scanner atau kata kunci pencarian.</p>
          </div>
        ) : viewMode === 'grid' ? (
          /* ==================================================== */
          /* MODE 1: VISUAL GRID (FOTO & KARTU MODERN)            */
          /* ==================================================== */
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 max-h-[68vh] overflow-y-auto pr-1">
            {filteredProducts.map((product) => {
              const isUnlimitedStock = product.stock >= 99999;
              const isOutOfStock = !isUnlimitedStock && product.stock <= 0;
              const cartItem = cart.find((i) => i.product.id === product.id);

              return (
                <button
                  key={product.id}
                  type="button"
                  disabled={isOutOfStock}
                  onClick={() => handleProductSelect(product)}
                  className={`rounded-2xl border text-left flex flex-col justify-between transition-all active:scale-[0.98] relative overflow-hidden group shadow-xs ${
                    isOutOfStock
                      ? 'bg-slate-100/70 border-slate-200 opacity-60 cursor-not-allowed'
                      : cartItem
                      ? 'bg-blue-50/40 border-blue-900/50 shadow-md ring-1 ring-blue-900/30'
                      : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-md'
                  }`}
                >
                  {/* Foto Produk dengan Aspect Ratio & Fallback Elegant */}
                  <div className="w-full h-32 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                    {product.modifiers && product.modifiers.length > 0 && (
                      <span className="absolute top-2 right-2 z-10 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-900/90 text-white shadow-xs">
                        ✨ Custom
                      </span>
                    )}
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-linear-to-br from-slate-50 to-slate-100 text-slate-400">
                        <Package className="w-8 h-8 opacity-40 mb-1" />
                        <span className="text-[10px] font-bold text-slate-400">Tanpa Foto</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

                    {/* Category Tag Overlay */}
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-white/95 backdrop-blur-xs text-[10px] font-extrabold text-blue-950 shadow-xs max-w-[70%] truncate">
                      {product.category?.name || 'Umum'}
                    </span>

                    {/* Stock Status Badge */}
                    <span
                      className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-md border backdrop-blur-xs shadow-xs ${
                        isUnlimitedStock
                          ? 'bg-emerald-600 text-white border-emerald-500 font-extrabold'
                          : isOutOfStock
                          ? 'bg-rose-500 text-white border-rose-600'
                          : product.stock <= 5
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-white/95 text-slate-700 border-white/60'
                      }`}
                    >
                      {isUnlimitedStock ? '✨ Bebas Stok' : isOutOfStock ? 'Habis' : `Stok: ${product.stock}`}
                    </span>

                    {/* Cart Indicator Badge */}
                    {cartItem && (
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-blue-900 text-white font-black text-xs flex items-center justify-center shadow-md ring-2 ring-white animate-bounce-short">
                        {cartItem.quantity}
                      </div>
                    )}
                  </div>

                  {/* Body Kartu Produk */}
                  <div className="p-3 flex flex-col justify-between flex-1">
                    <div>
                      <h4 className="font-bold text-blue-950 text-sm line-clamp-2 leading-snug">
                        {product.name}
                      </h4>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-[11px] text-slate-400 font-mono">{product.sku}</div>
                      <div className="text-sm font-black text-blue-950">
                        Rp {product.basePrice.toLocaleString('id-ID')}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          /* ==================================================== */
          /* MODE 2: COMPACT LIST (CEPAT UNTUK SCANNER BARCODE)  */
          /* ==================================================== */
          <div className="flex flex-col gap-2 max-h-[68vh] overflow-y-auto pr-1">
            {filteredProducts.map((product) => {
              const isUnlimitedStock = product.stock >= 99999;
              const isOutOfStock = !isUnlimitedStock && product.stock <= 0;
              const cartItem = cart.find((i) => i.product.id === product.id);

              return (
                <div
                  key={product.id}
                  onClick={() => !isOutOfStock && handleProductSelect(product)}
                  className={`p-3 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition-all active:scale-[0.99] ${
                    isOutOfStock
                      ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                      : cartItem
                      ? 'bg-blue-50/60 border-blue-900/40 shadow-xs ring-1 ring-blue-900/20'
                      : 'bg-white border-slate-200 hover:border-blue-300 hover:shadow-xs'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-12 h-12 rounded-xl object-cover shrink-0 border border-slate-100"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                        <Package className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="font-bold text-blue-950 text-sm truncate">{product.name}</h4>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span className="font-mono text-[11px] text-slate-400">{product.sku}</span>
                        <span>•</span>
                        <span className="text-[11px] font-semibold text-blue-900/80">{product.category?.name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="font-black text-blue-950 text-sm">
                        Rp {product.basePrice.toLocaleString('id-ID')}
                      </div>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          isUnlimitedStock
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200 font-extrabold'
                            : isOutOfStock
                            ? 'bg-rose-100 text-rose-700 border-rose-200'
                            : product.stock <= 5
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {isUnlimitedStock ? '✨ Bebas Stok' : isOutOfStock ? 'Habis' : `Stok: ${product.stock} ${product.unit}`}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isOutOfStock}
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm transition-all ${
                        cartItem
                          ? 'bg-blue-900 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-blue-900 hover:text-white text-slate-600'
                      }`}
                    >
                      {cartItem ? cartItem.quantity : <Plus className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ==================================================== */}
      {/* SISI KANAN (40%): KERANJANG KASIR & CHECKOUT         */}
      {/* ==================================================== */}
      <div className="w-full lg:w-2/5 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden sticky top-[135px]">
        {/* Cart Header */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-900" />
            <h3 className="font-extrabold text-blue-950 text-base">Keranjang</h3>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-900 text-white">
              {cart.reduce((a, b) => a + b.quantity, 0)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Tombol Antrean Tertahan dengan Badge */}
            <button
              type="button"
              onClick={() => setViewHoldOrdersModalOpen(true)}
              className="px-2.5 py-1 text-xs font-bold rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 transition-all flex items-center gap-1.5 shadow-xs"
              title="Daftar Antrean Pesanan Tertahan"
            >
              <Bookmark className="w-3.5 h-3.5 text-amber-600" />
              <span>Tertahan</span>
              {holdOrders.length > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-black">
                  {holdOrders.length}
                </span>
              )}
            </button>

            {/* Tombol Tahan Pesanan (F8) */}
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => {
                setHoldCustomerName(customerName);
                setHoldNote('');
                setHoldOrderModalOpen(true);
              }}
              className="px-2.5 py-1 text-xs font-bold rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 transition-all flex items-center gap-1 disabled:opacity-30 disabled:pointer-events-none"
              title="Tahan Pesanan Saat Ini (F8)"
            >
              <PauseCircle className="w-3.5 h-3.5 text-blue-900" />
              <span>Tahan (F8)</span>
            </button>

            {/* Tombol Bersihkan Keranjang */}
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={clearCart}
              title="Bersihkan Keranjang"
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-30"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Multi-Channel Saluran Penjualan Selector */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center justify-between">
            <span>Saluran Pesanan</span>
            <span
              className="text-[10px] font-black px-2 py-0.5 rounded-md"
              style={{
                color: ORDER_CHANNEL_LABELS[orderChannel]?.color || '#1e3a8a',
                backgroundColor: ORDER_CHANNEL_LABELS[orderChannel]?.bg || '#dbeafe',
              }}
            >
              {ORDER_CHANNEL_LABELS[orderChannel]?.badge || orderChannel}
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
            {[
              { id: 'DINE_IN', label: 'Dine In', icon: '🍽️' },
              { id: 'TAKEAWAY', label: 'Bungkus', icon: '🛍️' },
              { id: 'GOFOOD', label: 'GoFood', icon: '🛵' },
              { id: 'GRABFOOD', label: 'GrabFood', icon: '🟢' },
              { id: 'SHOPEEFOOD', label: 'Shopee', icon: '🟠' },
              { id: 'DELIVERY', label: 'Kurir', icon: '📦' },
            ].map((ch) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => setOrderChannel(ch.id as OrderChannel)}
                className={`py-1.5 px-1 rounded-xl text-[10px] font-bold border transition-all flex flex-col items-center justify-center gap-0.5 ${
                  orderChannel === ch.id
                    ? 'bg-blue-900 text-white border-blue-900 shadow-xs scale-[1.02]'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-blue-950'
                }`}
              >
                <span className="text-xs">{ch.icon}</span>
                <span className="truncate leading-tight text-[10px]">{ch.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Banner Pesanan Susulan */}
        {currentAppendingOrder && (
          <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between text-xs text-amber-950 font-medium">
            <div className="flex items-center gap-1.5 truncate">
              <span>📌</span>
              <span className="font-bold truncate">
                Order Susulan: Faktur #{currentAppendingOrder.invoiceNumber}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setCurrentAppendingOrder(null);
                onClearAppendOrder?.();
              }}
              className="text-amber-800 hover:text-amber-950 font-bold text-[11px] underline shrink-0 ml-2"
            >
              Lepas
            </button>
          </div>
        )}

        {/* Customer / Table Info & Member Selector */}
        <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-200/80">
          {selectedCustomer ? (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-2.5 py-1.5 text-xs">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-6 h-6 rounded-lg bg-blue-900 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                  ★
                </div>
                <div className="truncate">
                  <span className="font-bold text-blue-950">{selectedCustomer.name}</span>
                  {selectedCustomer.code && (
                    <span className="ml-1.5 font-mono text-[10px] text-blue-800 bg-blue-100 px-1 py-0.2 rounded font-bold">
                      {selectedCustomer.code}
                    </span>
                  )}
                  {selectedCustomer.phone && (
                    <span className="ml-1.5 text-[11px] text-slate-500 font-mono">
                      ({selectedCustomer.phone})
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleClearCustomer}
                title="Hapus / Ganti Pelanggan"
                className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-white transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nama / No. Meja"
                    className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 font-medium outline-none"
                  />
                </div>
                <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="No. WA Pelanggan"
                    className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 font-medium outline-none"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-0.5 border-t border-slate-200/50">
                <span className="text-[10px] text-slate-400 font-medium">Bukan member terdaftar?</span>
                <button
                  type="button"
                  onClick={() => setMemberPickerOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-900 hover:text-blue-950 hover:underline cursor-pointer"
                >
                  <UserCheck className="w-3 h-3" />
                  <span>Pilih / Cari Member</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Cart Items List */}
        <div className="p-4 overflow-y-auto max-h-[35vh] min-h-[160px] divide-y divide-slate-100 space-y-2">
          {cart.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-center">
              <Receipt className="w-8 h-8 text-slate-300 mb-1" />
              <p className="text-xs font-semibold">Keranjang masih kosong</p>
              <p className="text-[11px] text-slate-400">Klik produk di katalog atau scan barcode untuk transaksi</p>
            </div>
          ) : (
            cart.map((item) => {
              const itemKey = getItemKey(item);
              const unitPrice = item.customPrice !== undefined ? item.customPrice : item.product.basePrice;
              const effectivePrice = unitPrice - item.discountAmount;
              const itemTotal = effectivePrice * item.quantity;

              return (
                <div key={itemKey} className="pt-2 flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-xs sm:text-sm text-blue-950 truncate">
                        {item.product.name}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                        {item.discountAmount > 0 ? (
                          <>
                            <span className="line-through text-slate-400">
                              Rp {unitPrice.toLocaleString('id-ID')}
                            </span>
                            <span className="font-bold text-blue-900">
                              Rp {effectivePrice.toLocaleString('id-ID')}
                            </span>
                            <span className="text-[10px] text-rose-600 bg-rose-50 px-1 py-0.2 rounded font-bold">
                              -Rp {item.discountAmount.toLocaleString('id-ID')}
                            </span>
                          </>
                        ) : (
                          <span>
                            Rp {unitPrice.toLocaleString('id-ID')} / {item.product.unit}
                          </span>
                        )}
                      </div>

                      {/* Modifier options tags */}
                      {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.selectedModifiers.map((mod, mIdx) => (
                            <span
                              key={mIdx}
                              className="text-[10px] bg-purple-50 text-purple-800 border border-purple-200 px-1.5 py-0.2 rounded font-medium"
                            >
                              {mod.groupName}: {mod.option.name}
                              {mod.option.priceDelta > 0 && ` (+Rp ${mod.option.priceDelta.toLocaleString('id-ID')})`}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Catatan Khusus Item */}
                      {item.itemNote && (
                        <div className="text-[10px] italic text-amber-800 bg-amber-50/70 px-2 py-0.5 rounded border border-amber-200/60 mt-0.5">
                          📝 {item.itemNote}
                        </div>
                      )}
                    </div>

                    {/* Qty Controls */}
                    <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 border border-slate-200 shrink-0">
                      <button
                        type="button"
                        onClick={() => updateQuantity(itemKey, -1)}
                        className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors shadow-xs active:scale-95"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center font-extrabold text-xs text-blue-950">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(itemKey, 1)}
                        className="w-6 h-6 rounded-lg bg-white hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center transition-colors shadow-xs active:scale-95"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Line Total & Remove */}
                    <div className="text-right flex items-center gap-1.5 shrink-0">
                      <div className="font-black text-xs sm:text-sm text-blue-950 min-w-[65px] text-right">
                        Rp {itemTotal.toLocaleString('id-ID')}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFromCart(itemKey)}
                        className="text-slate-300 hover:text-rose-600 transition-colors p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Tombol Diskon Item */}
                  <div className="flex items-center justify-start gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItemDiscount({
                          productId: itemKey,
                          name: item.product.name,
                          basePrice: unitPrice,
                          currentDiscount: item.discountAmount,
                        });
                        setTempItemDiscount(item.discountAmount);
                      }}
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg border transition-all ${
                        item.discountAmount > 0
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-slate-50 text-slate-500 hover:text-blue-900 hover:border-blue-200 border-slate-200'
                      }`}
                    >
                      <Tag className="w-3 h-3" />
                      <span>
                        {item.discountAmount > 0
                          ? `Diskon: Rp ${item.discountAmount.toLocaleString('id-ID')}`
                          : '+ Diskon Item'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* On-Demand Packaging Add-ons (Biaya Tambahan Plastik & Box, dll) */}
        {cart.length > 0 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                  🛍️ Kemasan / On-Demand
                </span>
                {totalOnDemandItemsSelected > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-blue-900 text-white text-[10px] font-extrabold">
                    {totalOnDemandItemsSelected} pcs
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {packagingCost > 0 && (
                  <span className="text-blue-950 font-extrabold text-xs">
                    +Rp {packagingCost.toLocaleString('id-ID')}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setOnDemandPickerOpen(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-900 bg-white border border-blue-200 hover:bg-blue-50 px-2 py-0.5 rounded-lg shadow-2xs transition-all cursor-pointer"
                  title="Buka daftar lengkap biaya on-demand"
                >
                  <span>+ Biaya Lainnya</span>
                  {activeOnDemandFees.length > 4 && (
                    <span className="text-[9px] bg-blue-100 text-blue-900 font-extrabold px-1 rounded">
                      {activeOnDemandFees.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {displayQuickFees.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 text-xs">
                {displayQuickFees.map((fee) => {
                  const qty = onDemandQuantities[fee.id] || 0;
                  const isBox =
                    fee.name.toLowerCase().includes('box') ||
                    fee.name.toLowerCase().includes('kardus') ||
                    fee.name.toLowerCase().includes('paperbag');
                  return (
                    <div
                      key={fee.id}
                      className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                        qty > 0
                          ? 'bg-blue-50/50 border-blue-300 shadow-2xs'
                          : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                      }`}
                    >
                      <div className="truncate mr-1 max-w-[120px]">
                        <span className="font-bold text-slate-800 block text-xs truncate" title={fee.name}>
                          {isBox ? '📦 ' : '🛍️ '}
                          {fee.name}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Rp {fee.rate.toLocaleString('id-ID')} / pcs
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateOnDemandQty(fee.id, -1)}
                          disabled={qty === 0}
                          className="w-5 h-5 rounded-md bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:pointer-events-none text-slate-700 font-bold flex items-center justify-center text-xs cursor-pointer"
                        >
                          -
                        </button>
                        <span
                          className={`font-extrabold text-xs w-4 text-center ${
                            qty > 0 ? 'text-blue-900 font-black' : 'text-slate-400'
                          }`}
                        >
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateOnDemandQty(fee.id, 1)}
                          className="w-5 h-5 rounded-md bg-blue-900 text-white font-bold flex items-center justify-center text-xs hover:bg-blue-800 shadow-2xs cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-dashed border-slate-200 text-xs text-slate-500">
                <span>Belum ada biaya kemasan aktif</span>
                <button
                  type="button"
                  onClick={() => setSupervisorFeesModalOpen(true)}
                  className="text-blue-900 font-bold hover:underline cursor-pointer"
                >
                  + Tambah Biaya
                </button>
              </div>
            )}
          </div>
        )}

        {/* Calculation & Checkout Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50/70 space-y-2.5">
          {/* Subtotal */}
          <div className="flex justify-between text-xs text-slate-600 font-medium">
            <span>Subtotal ({cart.length} produk)</span>
            <span className="font-bold text-slate-900">
              Rp {subtotal.toLocaleString('id-ID')}
            </span>
          </div>

          {/* Diskon Total Item (Jika Ada) */}
          {totalItemDiscount > 0 && (
            <div className="flex justify-between text-xs text-rose-600 font-semibold">
              <span>Total Diskon Item</span>
              <span>- Rp {totalItemDiscount.toLocaleString('id-ID')}</span>
            </div>
          )}

          {/* Diskon Transaksi Global */}
          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
            <button
              type="button"
              onClick={() => {
                setTempGlobalDiscount(globalDiscount);
                setGlobalDiscountModalOpen(true);
              }}
              className="font-bold text-blue-900 hover:underline flex items-center gap-1"
            >
              <PercentCircle className="w-3.5 h-3.5" />
              <span>
                {globalDiscount > 0
                  ? `Diskon Transaksi (Rp ${globalDiscount.toLocaleString('id-ID')})`
                  : '+ Diskon Transaksi'}
              </span>
            </button>
            {globalDiscount > 0 && (
              <span className="font-bold text-rose-600">
                - Rp {globalDiscount.toLocaleString('id-ID')}
              </span>
            )}
          </div>

          {/* Biaya Dinamis & Pajak Outlet (Dikelola oleh Supervisor) */}
          <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <span>Biaya & Pajak Toko</span>
              </span>
              <button
                type="button"
                onClick={() => setSupervisorFeesModalOpen(true)}
                className="text-[11px] font-bold text-blue-900 hover:text-blue-950 flex items-center gap-1 hover:underline cursor-pointer"
                title="Kelola & Non/Aktifkan Biaya oleh Supervisor"
              >
                <Shield className="w-3 h-3 text-blue-900" />
                <span>⚙️ Kelola (SPV)</span>
              </button>
            </div>

            {feeBreakdown.length === 0 ? (
              <div className="text-[11px] text-slate-400 italic py-0.5">
                Tidak ada biaya tambahan aktif ({ORDER_CHANNEL_LABELS[orderChannel]?.label || orderChannel})
              </div>
            ) : (
              feeBreakdown.map((fee) => (
                <div key={fee.id} className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5 truncate max-w-[200px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">{fee.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal shrink-0">
                      ({fee.type === 'PERCENTAGE' ? `${fee.rate}%` : `Rp ${fee.rate.toLocaleString('id-ID')}`})
                    </span>
                  </span>
                  <span className="font-bold text-slate-700 shrink-0">
                    + Rp {fee.calculatedAmount.toLocaleString('id-ID')}
                  </span>
                </div>
              ))
            )}

            {packagingCost > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5 truncate max-w-[200px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span>Biaya Tambahan Kemasan</span>
                    <span className="text-[10px] text-slate-400 font-normal shrink-0">
                      ({totalOnDemandItemsSelected} item)
                    </span>
                  </span>
                  <span className="font-bold text-slate-700 shrink-0">
                    + Rp {packagingCost.toLocaleString('id-ID')}
                  </span>
                </div>
                {Object.entries(onDemandQuantities).map(([feeId, qty]) => {
                  if (qty <= 0) return null;
                  const fee = activeOnDemandFees.find((f) => f.id === feeId);
                  if (!fee) return null;
                  return (
                    <div key={feeId} className="flex justify-between pl-3 text-[11px] text-slate-500">
                      <span className="truncate max-w-[220px]">
                        • {qty}x {fee.name} (@ Rp {fee.rate.toLocaleString('id-ID')})
                      </span>
                      <span className="font-medium text-slate-600">
                        + Rp {(fee.rate * qty).toLocaleString('id-ID')}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Grand Total Display */}
          <div className="pt-2 border-t border-slate-200 flex items-baseline justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-slate-500">
              Total Bayar
            </span>
            <div className="text-2xl sm:text-3xl font-black text-blue-950 tracking-tight">
              Rp {grandTotal.toLocaleString('id-ID')}
            </div>
          </div>

          {/* Action Buttons: Split Bill & Bayar Sekarang (F4) */}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => setPaymentModalOpen(true)}
              className="py-3.5 px-3 rounded-2xl border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shrink-0"
              title="Pembayaran Campuran (Split Bill)"
            >
              <Split className="w-3.5 h-3.5" />
              <span>Split Bill</span>
            </button>

            <button
              type="button"
              disabled={cart.length === 0}
              onClick={() => setPaymentModalOpen(true)}
              className="flex-1 py-3.5 px-6 bg-blue-900 hover:bg-blue-800 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none text-white font-extrabold text-base rounded-2xl shadow-lg shadow-blue-900/25 transition-all flex items-center justify-center gap-2"
            >
              <span>Bayar Sekarang (F4)</span>
            </button>
          </div>
        </div>
      </div>

      {/* ==================================================== */}
      {/* MODAL: INPUT DISKON PER ITEM                         */}
      {/* ==================================================== */}
      {editingItemDiscount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-blue-950 text-base">Diskon Produk</h3>
                <p className="text-xs text-slate-500 truncate max-w-[240px]">
                  {editingItemDiscount.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingItemDiscount(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600">
              Harga Satuan:{' '}
              <span className="font-bold text-slate-900">
                Rp {editingItemDiscount.basePrice.toLocaleString('id-ID')}
              </span>
            </div>

            {/* Quick Percentage Presets */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Pilih Diskon Cepat:
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 20].map((pct) => {
                  const val = Math.round((editingItemDiscount.basePrice * pct) / 100);
                  return (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setTempItemDiscount(val)}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        tempItemDiscount === val
                          ? 'bg-blue-900 text-white border-blue-900'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      {pct}%
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nominal Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nominal Diskon (Rp):
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  Rp
                </span>
                <input
                  type="number"
                  min={0}
                  max={editingItemDiscount.basePrice}
                  value={tempItemDiscount}
                  onChange={(e) => setTempItemDiscount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 focus:border-blue-900 rounded-xl pl-9 pr-4 py-2 text-sm font-bold outline-none"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => applyItemDiscount(editingItemDiscount.productId, 0)}
                className="px-3 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold"
              >
                Hapus Diskon
              </button>
              <button
                type="button"
                onClick={() =>
                  applyItemDiscount(editingItemDiscount.productId, tempItemDiscount)
                }
                className="flex-1 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Terapkan Diskon
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      {/* MODAL: INPUT DISKON TRANSAKSI GLOBAL                 */}
      {/* ==================================================== */}
      {globalDiscountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-black text-blue-950 text-base">Diskon Transaksi</h3>
                <p className="text-xs text-slate-500">Potongan total pada faktur penjualan</p>
              </div>
              <button
                type="button"
                onClick={() => setGlobalDiscountModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Nominal Presets */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Pilihan Diskon Cepat:
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[5000, 10000, 20000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setTempGlobalDiscount(val)}
                    className={`py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      tempGlobalDiscount === val
                        ? 'bg-blue-900 text-white border-blue-900'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    Rp {(val / 1000).toFixed(0)}rb
                  </button>
                ))}
              </div>
            </div>

            {/* Nominal Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nominal Potongan (Rp):
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  Rp
                </span>
                <input
                  type="number"
                  min={0}
                  max={subtotal}
                  value={tempGlobalDiscount}
                  onChange={(e) => setTempGlobalDiscount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 focus:border-blue-900 rounded-xl pl-9 pr-4 py-2 text-sm font-bold outline-none"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setGlobalDiscount(0);
                  setGlobalDiscountModalOpen(false);
                }}
                className="px-3 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  setGlobalDiscount(Math.max(0, tempGlobalDiscount));
                  setGlobalDiscountModalOpen(false);
                }}
                className="flex-1 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Simpan Diskon
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: TAHAN PESANAN (HOLD ORDER) */}
      {holdOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <PauseCircle className="w-5 h-5 text-blue-900" />
                <h3 className="font-black text-blue-950 text-base">Tahan Pesanan (F8)</h3>
              </div>
              <button
                type="button"
                onClick={() => setHoldOrderModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Simpan sementara antrean belanja pelanggan ke daftar tertahan agar kasir dapat melayani pelanggan berikutnya.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nama Pelanggan / Meja:
                </label>
                <input
                  type="text"
                  value={holdCustomerName}
                  onChange={(e) => setHoldCustomerName(e.target.value)}
                  placeholder="misal: Meja 04 - Pak Budi"
                  className="w-full bg-white border border-slate-300 focus:border-blue-900 rounded-xl px-3 py-2 text-xs font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Catatan Tambahan (Opsional):
                </label>
                <textarea
                  rows={2}
                  value={holdNote}
                  onChange={(e) => setHoldNote(e.target.value)}
                  placeholder="misal: Pelanggan sedang mengambil barang lain"
                  className="w-full bg-white border border-slate-300 focus:border-blue-900 rounded-xl px-3 py-2 text-xs font-medium outline-none resize-none"
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-xl flex justify-between items-center text-xs">
                <span className="font-bold text-slate-600">Total Belanja:</span>
                <span className="font-black text-blue-950 text-sm">
                  Rp {grandTotal.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setHoldOrderModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveHoldOrder}
                className="flex-1 py-2 bg-blue-900 hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs"
              >
                Tahan Pesanan Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: DAFTAR PESANAN TERTAHAN */}
      {viewHoldOrdersModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <Bookmark className="w-5 h-5 text-amber-600" />
                <h3 className="font-black text-blue-950 text-base">
                  Daftar Pesanan Tertahan ({holdOrders.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewHoldOrdersModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 min-h-[150px]">
              {holdOrders.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <PauseCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-bold text-slate-600">Tidak ada pesanan tertahan</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Gunakan tombol "Tahan (F8)" saat transaksi berlangsung untuk menyimpan antrean.
                  </p>
                </div>
              ) : (
                holdOrders.map((hold) => (
                  <div
                    key={hold.id}
                    className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 hover:border-blue-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-sm text-blue-950">
                          {hold.customerName || 'Pelanggan Tanpa Nama'}
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Ditahan: {new Date(hold.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                          {hold.cashier?.name && ` • Oleh ${hold.cashier.name}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="font-black text-blue-900 text-sm">
                          Rp {Number(hold.totalAmount).toLocaleString('id-ID')}
                        </span>
                        <p className="text-[10px] text-slate-400">
                          {hold.items.length} jenis item
                        </p>
                      </div>
                    </div>

                    {hold.note && (
                      <div className="text-[11px] italic text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">
                        Catatan: "{hold.note}"
                      </div>
                    )}

                    <div className="text-[11px] text-slate-600 line-clamp-1">
                      {hold.items.map((i) => `${i.name} (x${i.quantity})`).join(', ')}
                    </div>

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeleteHoldOrder(hold.id)}
                        className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                      >
                        Hapus
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRestoreHoldOrder(hold)}
                        className="px-4 py-1.5 bg-blue-900 hover:bg-blue-800 text-white text-xs font-bold rounded-xl transition-all shadow-xs"
                      >
                        Lanjutkan Pesanan
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payment Dialog Modal */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        grandTotal={grandTotal}
        onCheckout={handleExecuteCheckout}
        loading={checkoutLoading}
        selectedCustomer={selectedCustomer}
        customerName={customerName}
        onOpenCustomerPicker={() => setMemberPickerOpen(true)}
      />

      {/* Order Success & Print Modal */}
      <OrderSuccessModal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        order={lastOrder}
        onAppendOrder={(ord) => {
          setCurrentAppendingOrder(ord);
          if (ord.customerName) setCustomerName(ord.customerName);
        }}
      />

      {/* Start Shift Modal */}
      <StartShiftModal
        isOpen={startShiftModalOpen}
        onClose={() => setStartShiftModalOpen(false)}
        onShiftStarted={(shift) => {
          setCurrentShift(shift);
          loadCurrentShift();
        }}
      />

      {/* X-Report Slip Modal */}
      <XReportModal
        isOpen={xReportModalOpen}
        onClose={() => setXReportModalOpen(false)}
      />

      {/* Close Shift (Z-Report) Modal */}
      <CloseShiftModal
        isOpen={closeShiftModalOpen}
        onClose={() => setCloseShiftModalOpen(false)}
        onShiftClosed={() => {
          setCurrentShift(null);
          loadCurrentShift();
        }}
        currentShift={currentShift}
      />

      {/* Modal Edukasi Upgrade PRO (Feature Guarding) */}
      <UpgradeModal
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        title="Fitur Khusus Paket PRO"
        message={upgradeMessage}
        featureHighlight={upgradeFeatureHighlight}
      />

      {/* Modal Pemilih Member Pelanggan Kasir */}
      {memberPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-900 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-sm">Pilih Member / Pelanggan</h3>
                  <p className="text-[11px] text-slate-400">Pilih dari member toko atau daftarkan cepat</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMemberPickerOpen(false);
                  setShowQuickAdd(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              {!showQuickAdd ? (
                <>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        autoFocus
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder="Cari nama, no WA, atau kode member..."
                        className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900 focus:bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowQuickAdd(true)}
                      className="px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-900 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer"
                    >
                      + Member Baru
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-[320px] overflow-y-auto pt-1">
                    {loadingMembers ? (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        Mencari data member...
                      </div>
                    ) : memberList.length === 0 ? (
                      <div className="py-8 text-center bg-slate-50 rounded-xl border border-slate-200/60 p-4">
                        <Users className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                        <p className="text-xs font-bold text-slate-700">Member tidak ditemukan</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Belum ada member yang cocok dengan "{memberSearch}"
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setQuickAddName(memberSearch);
                            setShowQuickAdd(true);
                          }}
                          className="mt-3 px-3 py-1.5 bg-blue-900 text-white rounded-lg text-xs font-bold hover:bg-blue-950 cursor-pointer"
                        >
                          + Daftarkan "{memberSearch}" Sekarang
                        </button>
                      </div>
                    ) : (
                      memberList.map((m) => (
                        <div
                          key={m.id}
                          onClick={() => handleSelectCustomer(m)}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/70 hover:border-blue-900 hover:bg-blue-50/50 cursor-pointer transition-all group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-blue-900 group-hover:text-white text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 transition-colors">
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="truncate">
                              <div className="font-bold text-xs text-slate-900 group-hover:text-blue-950 truncate">
                                {m.name}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono mt-0.5">
                                {m.phone && <span>{m.phone}</span>}
                                {m.code && (
                                  <span className="bg-slate-100 text-slate-600 px-1 py-0.2 rounded font-sans text-[10px]">
                                    {m.code}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0 ml-2">
                            <span className="text-xs font-bold text-blue-900 group-hover:underline block">
                              Pilih
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {m.visitCount}x Belanja
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <form onSubmit={handleQuickAddCustomer} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">Daftar Cepat Member Baru</span>
                    <button
                      type="button"
                      onClick={() => setShowQuickAdd(false)}
                      className="text-xs text-blue-900 font-semibold hover:underline"
                    >
                      ← Kembali ke Pencarian
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nama Pelanggan <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      placeholder="Nama lengkap member"
                      value={quickAddName}
                      onChange={(e) => setQuickAddName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900 focus:bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nomor WhatsApp / HP
                    </label>
                    <input
                      type="tel"
                      placeholder="081234567890"
                      value={quickAddPhone}
                      onChange={(e) => setQuickAddPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-900 focus:bg-white"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowQuickAdd(false)}
                      className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={quickAddSubmitting || !quickAddName.trim()}
                      className="px-4 py-1.5 bg-blue-900 hover:bg-blue-950 text-white rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
                    >
                      {quickAddSubmitting ? 'Menyimpan...' : 'Simpan & Pilih'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Pengaturan Biaya & Pajak Supervisor */}
      {activeOutlet && (
        <SupervisorFeesModal
          isOpen={supervisorFeesModalOpen}
          onClose={() => setSupervisorFeesModalOpen(false)}
          outlet={activeOutlet}
          currentUserRole={currentUserRole}
          onSaved={(updatedFees) => {
            setOutletFees(updatedFees);
            if (onOutletFeesUpdated) {
              onOutletFeesUpdated(updatedFees);
            }
          }}
        />
      )}

      {/* Modal Pemilihan Kemasan & Biaya Tambahan On-Demand Lengkap */}
      <OnDemandFeesPickerModal
        isOpen={onDemandPickerOpen}
        onClose={() => setOnDemandPickerOpen(false)}
        onDemandFees={activeOnDemandFees}
        currentQuantities={onDemandQuantities}
        onConfirm={(newQuantities: Record<string, number>) => {
          setOnDemandQuantities(newQuantities);
          setOnDemandPickerOpen(false);
        }}
        onOpenManageFees={() => {
          setOnDemandPickerOpen(false);
          setSupervisorFeesModalOpen(true);
        }}
      />

      {/* Modal Kustomisasi Modifiers Produk Makanan / Minuman */}
      <ProductModifierModal
        isOpen={modifierModalOpen}
        onClose={() => {
          setModifierModalOpen(false);
          setSelectedProductForModifier(null);
        }}
        product={selectedProductForModifier}
        onConfirm={handleConfirmModifier}
      />
      </div>
    </div>
  );
};
