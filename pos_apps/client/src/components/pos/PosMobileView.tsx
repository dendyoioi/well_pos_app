import React, { useState, useMemo } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  X,
  CreditCard,
  UtensilsCrossed,
  Clock,
  Ticket,
  PauseCircle,
  Menu,
  Monitor,
  Banknote,
  FileText,
  User,
  Package,
  Utensils,
  ChevronDown,
} from 'lucide-react';
import type { Product, Category } from '../../types/product';
import type { CartItem, OrderChannel } from '../../types/order';
import { ORDER_CHANNEL_LABELS } from '../../types/order';
import type { Customer } from '../../types/customer';
import type { Outlet, OutletFee } from '../../types/outlet';
import type { Promotion } from '../../types/promotion';
import type { Shift } from '../../types/shift';
import type { QrTable } from '../../types/qr_menu';

export interface PosMobileViewProps {
  activeOutlet: Outlet | null | undefined;
  currentShift: Shift | null;
  currentUserRole?: string;
  canCashOut?: boolean;
  orderChannel: OrderChannel;
  onChangeOrderChannel: (ch: OrderChannel) => void;
  tableNumber: string;
  onChangeTableNumber: (tbl: string) => void;
  tables: QrTable[];
  customerName: string;
  onChangeCustomerName: (name: string) => void;
  customerPhone: string;
  onChangeCustomerPhone: (phone: string) => void;
  selectedCustomer: Customer | null;
  onSelectCustomer: (c: Customer | null) => void;
  customers: Customer[];
  categories: Category[];
  selectedCategory: string;
  onSelectCategory: (catId: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  products: Product[];
  filteredProducts: Product[];
  loading: boolean;
  onSelectProduct: (p: Product) => void;
  cart: CartItem[];
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  serviceChargeAmount: number;
  cartGrandTotal: number;
  onOpenPayment: () => void;
  onSaveOpenTab?: () => void;
  onHoldOrder: () => void;
  holdOrdersCount: number;
  onOpenHeldOrders: () => void;
  openTabsCount: number;
  onOpenOpenTabs: () => void;
  qrOrdersCount: number;
  onOpenQrOrders: () => void;
  onOpenStartShift: () => void;
  onOpenCloseShift: () => void;
  onOpenXReport: () => void;
  onOpenCashExpense?: () => void;
  onToggleDesktopMode: () => void;
  appliedPromotion?: Promotion | null;
  onOpenVoucherPicker?: () => void;
  onRemovePromotion?: () => void;
  globalDiscount: number;
  onChangeGlobalDiscount: (discount: number) => void;
  activeFees: OutletFee[];
}

export const PosMobileView: React.FC<PosMobileViewProps> = ({
  activeOutlet,
  currentShift,
  canCashOut,
  orderChannel,
  onChangeOrderChannel,
  tableNumber,
  onChangeTableNumber,
  tables,
  customerName,
  onChangeCustomerName,
  customerPhone,
  onChangeCustomerPhone,
  categories,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  products,
  filteredProducts,
  loading,
  onSelectProduct,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  subtotal,
  discountAmount,
  taxAmount,
  serviceChargeAmount,
  cartGrandTotal,
  onOpenPayment,
  onSaveOpenTab,
  onHoldOrder,
  holdOrdersCount,
  onOpenHeldOrders,
  openTabsCount,
  onOpenOpenTabs,
  qrOrdersCount,
  onOpenQrOrders,
  onOpenStartShift,
  onOpenCloseShift,
  onOpenXReport,
  onOpenCashExpense,
  onToggleDesktopMode,
  appliedPromotion,
  onOpenVoucherPicker,
  onRemovePromotion,
}) => {
  // Mobile UI States
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [tablePickerOpen, setTablePickerOpen] = useState(false);
  const [showCustomerInputs, setShowCustomerInputs] = useState(false);

  // Total quantity in cart
  const cartItemCount = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  }, [cart]);

  // Quantity map of product IDs in cart
  const cartProductQuantities = useMemo(() => {
    const map = new Map<string, number>();
    cart.forEach((item) => {
      const current = map.get(item.product.id) || 0;
      map.set(item.product.id, current + item.quantity);
    });
    return map;
  }, [cart]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] sm:h-[calc(100vh-6.5rem)] bg-slate-100 select-none font-sans overflow-hidden relative">
      {/* 1. Mobile Sticky Top Header */}
      <header className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white px-3.5 py-2.5 shrink-0 shadow-md z-20 flex items-center justify-between gap-2">
        {/* Left: Outlet & Shift Status */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-blue-800 flex items-center justify-center text-white font-black text-xs shrink-0 shadow-xs">
            {activeOutlet?.name?.charAt(0).toUpperCase() || 'W'}
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-xs text-white truncate leading-tight">
              {activeOutlet?.name || 'Kasir Handheld'}
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  currentShift ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="text-[10px] text-blue-200 truncate">
                {currentShift
                  ? `Shift Aktif • ${currentShift.cashier?.name || 'Kasir'}`
                  : 'Shift Tutup'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Channel selector badge */}
          <button
            type="button"
            onClick={() => {
              const channels: OrderChannel[] = ['DINE_IN', 'TAKEAWAY', 'DELIVERY'];
              const nextIndex = (channels.indexOf(orderChannel) + 1) % channels.length;
              onChangeOrderChannel(channels[nextIndex]);
            }}
            className="px-2 py-1 rounded-lg bg-blue-800/80 hover:bg-blue-700/80 border border-blue-700 text-[10px] font-bold text-white flex items-center gap-1 transition-all"
          >
            <span>{ORDER_CHANNEL_LABELS[orderChannel]?.label || orderChannel}</span>
            {orderChannel === 'DINE_IN' && tableNumber && (
              <span className="text-amber-300">#{tableNumber}</span>
            )}
          </button>

          {/* Quick Menu Hamburger */}
          <button
            type="button"
            onClick={() => setQuickMenuOpen(true)}
            className="p-1.5 rounded-xl bg-blue-800 hover:bg-blue-700 text-white relative transition-colors"
            title="Menu Operasional Kasir"
          >
            <Menu className="w-4 h-4" />
            {(holdOrdersCount > 0 || openTabsCount > 0 || qrOrdersCount > 0) && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 text-white text-[8px] font-black rounded-full flex items-center justify-center border-2 border-blue-950">
                {holdOrdersCount + openTabsCount + qrOrdersCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* 2. Search Bar & Horizontal Category Carousel */}
      <div className="bg-white border-b border-slate-200 p-2.5 space-y-2 shrink-0 shadow-2xs">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari menu atau kode..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 focus:border-blue-900 focus:bg-white rounded-xl pl-8 pr-7 py-1.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Horizontal Category Carousel */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
          <button
            type="button"
            onClick={() => onSelectCategory('all')}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all shrink-0 ${
              selectedCategory === 'all'
                ? 'bg-blue-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({products.length})
          </button>
          {categories.map((cat) => {
            const count = products.filter((p) => p.category?.id === cat.id).length;
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all shrink-0 ${
                  isSelected
                    ? 'bg-blue-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.name} {count > 0 ? `(${count})` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Product Catalog Grid (2 Columns, Thumb-Friendly) */}
      <div className="flex-1 overflow-y-auto p-2.5 pb-24">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
            <div className="w-7 h-7 border-3 border-blue-900 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold">Memuat menu...</span>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 px-4">
            <Package className="w-10 h-10 mb-2 text-slate-300 stroke-[1.5]" />
            <p className="text-xs font-bold text-slate-600">Tidak ada produk ditemukan</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Coba kata kunci atau kategori lain</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {filteredProducts.map((product) => {
              const price = product.price || product.basePrice || 0;
              const hasModifiers = (product.modifiers?.length || 0) > 0;
              const isComposite = product.productType === 'COMPOSITE' || product.hasStock === false;
              const stock = product.stock ?? 0;
              const isUnlimited = isComposite || stock >= 99999;
              const isOutOfStock = !isUnlimited && stock <= 0;
              const inCartQty = cartProductQuantities.get(product.id) || 0;

              return (
                <div
                  key={product.id}
                  onClick={() => !isOutOfStock && onSelectProduct(product)}
                  className={`bg-white rounded-2xl border p-2 flex flex-col justify-between transition-all duration-100 active:scale-[0.97] cursor-pointer relative overflow-hidden shadow-2xs ${
                    inCartQty > 0
                      ? 'border-blue-900 ring-2 ring-blue-900/10'
                      : 'border-slate-200/90 hover:border-blue-400'
                  } ${isOutOfStock ? 'opacity-40 cursor-not-allowed bg-slate-50' : ''}`}
                >
                  {/* Quantity In Cart Indicator Badge */}
                  {inCartQty > 0 && (
                    <div className="absolute top-1.5 left-1.5 z-10">
                      <span className="bg-blue-900 text-white text-[10px] font-black px-1.5 py-0.2 rounded-md shadow-xs">
                        {inCartQty}x
                      </span>
                    </div>
                  )}

                  {/* Thumbnail Image */}
                  <div className="w-full h-24 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden relative mb-2">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="text-slate-300">
                        {hasModifiers ? (
                          <Utensils className="w-6 h-6 stroke-[1.5]" />
                        ) : (
                          <Package className="w-6 h-6 stroke-[1.5]" />
                        )}
                      </div>
                    )}

                    {/* Modifier Tag */}
                    {hasModifiers && (
                      <span className="absolute bottom-1 right-1 bg-slate-900/80 text-violet-300 text-[8px] font-black px-1 py-0.2 rounded">
                        Varian
                      </span>
                    )}

                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-2xs flex items-center justify-center">
                        <span className="bg-rose-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded uppercase">
                          Habis
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Product Details */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="font-extrabold text-xs text-slate-900 line-clamp-2 leading-tight">
                        {product.name}
                      </h3>
                      <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                        {product.category?.name || 'Menu'}
                      </p>
                    </div>

                    <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between">
                      <span className="font-black text-xs text-blue-950">
                        Rp {price.toLocaleString('id-ID')}
                      </span>
                      <button
                        type="button"
                        className="w-6 h-6 rounded-lg bg-blue-900 text-white flex items-center justify-center active:bg-blue-950 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Floating Action Cart Bar (Sticky Bottom) */}
      {cart.length > 0 && (
        <div className="absolute bottom-3 left-3 right-3 z-30 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            onClick={() => setCartDrawerOpen(true)}
            className="bg-gradient-to-r from-blue-950 via-blue-900 to-indigo-950 text-white rounded-2xl p-3 shadow-xl border border-blue-800/80 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-800 flex items-center justify-center text-white shrink-0 shadow-xs relative">
                <ShoppingCart className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-blue-950">
                  {cartItemCount}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-blue-200 block truncate">
                  {cartItemCount} Item Dipilih
                </span>
                <span className="text-sm font-black text-white block truncate leading-none">
                  Rp {cartGrandTotal.toLocaleString('id-ID')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-white text-blue-950 px-3 py-1.5 rounded-xl font-black text-xs shrink-0 shadow-xs">
              <span>Periksa Pesanan</span>
              <span className="text-blue-900 font-bold">➔</span>
            </div>
          </div>
        </div>
      )}

      {/* 5. Mobile Bottom Sheet Cart Drawer */}
      {cartDrawerOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/60 backdrop-blur-2xs animate-in fade-in duration-150">
          {/* Backdrop click to close */}
          <div className="flex-1" onClick={() => setCartDrawerOpen(false)} />

          <div className="bg-white rounded-t-3xl shadow-2xl border-t border-slate-200 flex flex-col max-h-[88vh] animate-in slide-in-from-bottom duration-200">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-2.5 shrink-0" />

            {/* Sheet Header */}
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-900 flex items-center justify-center font-black text-xs">
                  {cartItemCount}
                </div>
                <h2 className="font-extrabold text-sm text-slate-900">Pesanan Kasir</h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClearCart();
                    setCartDrawerOpen(false);
                  }}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                  title="Hapus keranjang"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Kosongkan</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCartDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sheet Subheader: Order Channel & Table Controls */}
            <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
              {/* Channel switcher */}
              <div className="flex items-center gap-1 overflow-x-auto text-[11px] font-bold">
                {(['DINE_IN', 'TAKEAWAY', 'DELIVERY'] as OrderChannel[]).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => onChangeOrderChannel(ch)}
                    className={`px-2.5 py-1 rounded-lg transition-all ${
                      orderChannel === ch
                        ? 'bg-blue-900 text-white shadow-xs'
                        : 'bg-white border border-slate-200 text-slate-600'
                    }`}
                  >
                    {ORDER_CHANNEL_LABELS[ch]?.label || ch}
                  </button>
                ))}
              </div>

              {/* Table number selector for Dine In */}
              {orderChannel === 'DINE_IN' && (
                <button
                  type="button"
                  onClick={() => setTablePickerOpen(!tablePickerOpen)}
                  className="px-2.5 py-1 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-bold flex items-center gap-1 shrink-0"
                >
                  <span>{tableNumber ? `Meja ${tableNumber}` : 'Pilih Meja'}</span>
                  <ChevronDown className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Customer Name Toggle Bar */}
            <div className="px-3.5 py-1.5 border-b border-slate-100 flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-1 text-slate-600">
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold">
                  {customerName ? `${customerName} (${customerPhone || '-'})` : 'Pelanggan Umum'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCustomerInputs(!showCustomerInputs)}
                className="text-blue-900 font-bold hover:underline"
              >
                {showCustomerInputs ? 'Tutup' : 'Ubah Nama'}
              </button>
            </div>

            {showCustomerInputs && (
              <div className="p-3 bg-slate-50 border-b border-slate-200 flex gap-2">
                <input
                  type="text"
                  placeholder="Nama Pelanggan..."
                  value={customerName}
                  onChange={(e) => onChangeCustomerName(e.target.value)}
                  className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none"
                />
                <input
                  type="text"
                  placeholder="No. WhatsApp..."
                  value={customerPhone}
                  onChange={(e) => onChangeCustomerPhone(e.target.value)}
                  className="w-32 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 outline-none"
                />
              </div>
            )}

            {/* Table Quick Grid (Conditional dropdown) */}
            {tablePickerOpen && orderChannel === 'DINE_IN' && (
              <div className="p-3 bg-amber-50/60 border-b border-amber-200 max-h-40 overflow-y-auto shrink-0">
                <div className="grid grid-cols-4 gap-1.5">
                  {tables.map((tbl) => (
                    <button
                      key={tbl.id}
                      type="button"
                      onClick={() => {
                        onChangeTableNumber(tbl.tableNumber);
                        setTablePickerOpen(false);
                      }}
                      className={`p-1.5 rounded-lg border text-xs font-bold text-center ${
                        tableNumber === tbl.tableNumber
                          ? 'bg-blue-900 text-white border-blue-900'
                          : 'bg-white text-slate-800 border-slate-200 hover:border-amber-400'
                      }`}
                    >
                      M-{tbl.tableNumber}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Scrollable Cart Items */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 divide-y divide-slate-100">
              {cart.map((item, index) => {
                const itemPrice = item.customPrice || item.product.price || item.product.basePrice || 0;
                const itemTotal = itemPrice * item.quantity;
                const hasModifiers = item.selectedModifiers && item.selectedModifiers.length > 0;

                return (
                  <div key={`${item.product.id}-${index}`} className="pt-2.5 first:pt-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-extrabold text-xs text-slate-900 leading-tight">
                          {item.product.name}
                        </h4>
                        <div className="text-[11px] font-semibold text-slate-500 mt-0.5">
                          Rp {itemPrice.toLocaleString('id-ID')}
                        </div>

                        {/* Modifiers List */}
                        {hasModifiers && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {item.selectedModifiers?.map((mod, mi) => (
                              <span
                                key={mi}
                                className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-violet-50 text-violet-700 border border-violet-200"
                              >
                                +{mod.option?.name || mod.groupName}
                              </span>
                            ))}
                          </div>
                        )}

                        {item.itemNote && (
                          <p className="text-[10px] text-slate-400 italic mt-0.5">
                            Catatan: {item.itemNote}
                          </p>
                        )}
                      </div>

                      {/* Stepper Controls */}
                      <div className="flex items-center gap-1.5 shrink-0 bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(index, -1)}
                          className="w-6 h-6 rounded-lg bg-white text-slate-700 flex items-center justify-center font-bold text-xs shadow-xs active:bg-slate-200"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-xs font-black text-slate-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQuantity(index, 1)}
                          className="w-6 h-6 rounded-lg bg-blue-900 text-white flex items-center justify-center font-bold text-xs shadow-xs active:bg-blue-950"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => onRemoveItem(index)}
                        className="text-slate-400 hover:text-rose-600 text-[10px] font-semibold flex items-center gap-0.5"
                      >
                        <X className="w-3 h-3" /> Hapus
                      </button>
                      <span className="font-extrabold text-xs text-blue-950">
                        Rp {itemTotal.toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Financial Summary & Promo */}
            <div className="p-3.5 bg-slate-50 border-t border-slate-200 space-y-2 shrink-0">
              {/* Voucher Action Pill */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={onOpenVoucherPicker}
                  className="px-2.5 py-1 rounded-lg border border-dashed border-blue-400 bg-blue-50/50 text-blue-900 text-xs font-bold flex items-center gap-1.5"
                >
                  <Ticket className="w-3.5 h-3.5 text-blue-700" />
                  <span>{appliedPromotion ? appliedPromotion.code : 'Pakai Voucher / Kupon'}</span>
                </button>
                {appliedPromotion && onRemovePromotion && (
                  <button
                    type="button"
                    onClick={onRemovePromotion}
                    className="text-rose-600 text-[11px] font-bold"
                  >
                    Batal
                  </button>
                )}
              </div>

              {/* Total Breakdown */}
              <div className="space-y-1 text-[11px] text-slate-600 border-t border-slate-200/80 pt-2">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold text-slate-900">
                    Rp {subtotal.toLocaleString('id-ID')}
                  </span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>Potongan Diskon</span>
                    <span>-Rp {discountAmount.toLocaleString('id-ID')}</span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Pajak (PB1)</span>
                    <span>Rp {taxAmount.toLocaleString('id-ID')}</span>
                  </div>
                )}
                {serviceChargeAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Biaya Layanan</span>
                    <span>Rp {serviceChargeAmount.toLocaleString('id-ID')}</span>
                  </div>
                )}
                <div className="flex justify-between items-baseline pt-1.5 border-t border-slate-200 font-black text-slate-900 text-sm">
                  <span>Total Tagihan:</span>
                  <span className="text-base text-blue-900">
                    Rp {cartGrandTotal.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>

              {/* Shift Warning */}
              {!currentShift && (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
                  <span className="font-bold">Shift belum dibuka</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCartDrawerOpen(false);
                      onOpenStartShift();
                    }}
                    className="px-2 py-0.5 bg-amber-600 text-white rounded-md text-[10px] font-bold"
                  >
                    Buka Shift
                  </button>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-1.5 pt-1">
                <button
                  type="button"
                  disabled={cart.length === 0 || !currentShift}
                  onClick={() => {
                    setCartDrawerOpen(false);
                    onOpenPayment();
                  }}
                  className="w-full py-3 bg-gradient-to-r from-blue-900 to-indigo-900 hover:from-blue-950 hover:to-indigo-950 text-white rounded-xl font-black text-sm shadow-md flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Bayar Sekarang (Rp {cartGrandTotal.toLocaleString('id-ID')})</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={cart.length === 0 || !currentShift}
                    onClick={() => {
                      setCartDrawerOpen(false);
                      onHoldOrder();
                    }}
                    className="flex-1 py-2 bg-amber-50 border border-amber-300 text-amber-900 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-amber-100 disabled:opacity-50"
                  >
                    <PauseCircle className="w-3.5 h-3.5 text-amber-700" />
                    <span>Tahan Antrean</span>
                  </button>

                  {(orderChannel === 'DINE_IN' || orderChannel === 'QR_MENU') && onSaveOpenTab && (
                    <button
                      type="button"
                      disabled={cart.length === 0 || !currentShift}
                      onClick={() => {
                        setCartDrawerOpen(false);
                        onSaveOpenTab();
                      }}
                      className="flex-1 py-2 bg-white border border-blue-300 text-blue-950 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-blue-50/60 disabled:opacity-50"
                    >
                      <UtensilsCrossed className="w-3.5 h-3.5 text-blue-900" />
                      <span>Kirim Dapur</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Quick Menu Drawer (Hamburger Menu) */}
      {quickMenuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="flex-1" onClick={() => setQuickMenuOpen(false)} />
          <div className="bg-white w-[300px] h-full shadow-2xl flex flex-col justify-between p-4 animate-in slide-in-from-right duration-200">
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-900 text-white flex items-center justify-center font-black text-xs">
                    POS
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">Menu Kasir</h3>
                    <p className="text-[10px] text-slate-400">Mode Handheld 6.8"</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setQuickMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Shift Actions */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Manajemen Kasir &amp; Laci
                </span>

                {canCashOut && onOpenCashExpense && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenCashExpense();
                    }}
                    className="w-full p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-950 font-bold text-xs flex items-center gap-2.5 transition-colors"
                  >
                    <Banknote className="w-4 h-4 text-amber-700" />
                    <span>Kas Keluar / Petty Cash</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setQuickMenuOpen(false);
                    onOpenXReport();
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center gap-2.5 transition-colors border border-slate-200"
                >
                  <FileText className="w-4 h-4 text-blue-900" />
                  <span>Cetak X-Report (Laporan Berjalan)</span>
                </button>

                {currentShift ? (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenCloseShift();
                    }}
                    className="w-full p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs flex items-center gap-2.5 transition-colors border border-rose-200"
                  >
                    <Clock className="w-4 h-4 text-rose-600" />
                    <span>Tutup Shift (Z-Report)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenStartShift();
                    }}
                    className="w-full p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-2.5 transition-colors border border-emerald-200"
                  >
                    <Clock className="w-4 h-4 text-emerald-600" />
                    <span>Buka Shift Kasir</span>
                  </button>
                )}
              </div>

              {/* Order Lists */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Antrean &amp; Tagihan
                </span>

                <button
                  type="button"
                  onClick={() => {
                    setQuickMenuOpen(false);
                    onOpenOpenTabs();
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-between transition-colors border border-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-blue-900" />
                    <span>Tagihan Meja (Open Tabs)</span>
                  </div>
                  {openTabsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-blue-900 text-white text-[10px] font-black">
                      {openTabsCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setQuickMenuOpen(false);
                    onOpenHeldOrders();
                  }}
                  className="w-full p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-between transition-colors border border-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <PauseCircle className="w-4 h-4 text-amber-700" />
                    <span>Tahan Antrean (Hold)</span>
                  </div>
                  {holdOrdersCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-white text-[10px] font-black">
                      {holdOrdersCount}
                    </span>
                  )}
                </button>

                {qrOrdersCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuickMenuOpen(false);
                      onOpenQrOrders();
                    }}
                    className="w-full p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs flex items-center justify-between transition-colors border border-emerald-200"
                  >
                    <div className="flex items-center gap-2">
                      <Ticket className="w-4 h-4 text-emerald-700" />
                      <span>Pesanan QR Meja</span>
                    </div>
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-black">
                      {qrOrdersCount}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Bottom: Desktop Mode Switcher */}
            <div className="pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setQuickMenuOpen(false);
                  onToggleDesktopMode();
                }}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <Monitor className="w-4 h-4 text-slate-600" />
                <span>Beralih ke Tampilan Desktop</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
