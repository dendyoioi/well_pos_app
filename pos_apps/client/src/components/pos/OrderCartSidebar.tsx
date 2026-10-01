import React, { useState } from 'react';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  User,
  UserCheck,
  PercentCircle,
  Package,
  PauseCircle,
  Split,
  CreditCard,
  Bike,
  Search,
  Check,
  X,
  Clock,
  UtensilsCrossed,
  Utensils,
  Ticket,
  ChefHat,
  Printer,
} from 'lucide-react';
import type { CartItem, OrderChannel } from '../../types/order';
import { ORDER_CHANNEL_LABELS } from '../../types/order';
import type { Customer } from '../../types/customer';
import type { Outlet, OutletFee } from '../../types/outlet';
import type { Promotion } from '../../types/promotion';
import { Button } from '../ui';

export interface OrderCartSidebarProps {
  outlet?: Outlet | null;
  pointsToRedeem?: number;
  onChangePointsToRedeem?: (points: number) => void;
  cart: CartItem[];
  onUpdateQuantity: (index: number, delta: number) => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  orderChannel: OrderChannel;
  tableNumber?: string;
  onChangeTableNumber?: (tableNumber: string) => void;
  onlineOrderId?: string;
  onChangeOnlineOrderId?: (onlineOrderId: string) => void;
  availableTables?: Array<{
    id: string;
    tableNumber: string;
    name: string;
    section?: string;
    capacity?: number;
    status?: string;
  }>;
  customerName: string;
  onChangeCustomerName: (name: string) => void;
  customerPhone: string;
  onChangeCustomerPhone: (phone: string) => void;
  selectedCustomer: Customer | null;
  onSelectCustomer: (customer: Customer | null) => void;
  customers: Customer[];
  globalDiscount: number;
  onChangeGlobalDiscount: (discount: number) => void;
  activeFees: OutletFee[];
  onDemandQuantities: Record<string, number>;
  onOpenOnDemandPicker?: () => void;
  onHoldOrder: () => void;
  onSplitBill: () => void;
  onOpenPayment: () => void;
  disabledPayment?: boolean;
  currentShift?: any;
  onOpenStartShift?: () => void;
  onSaveOpenTab?: () => void;
  activeOpenTab?: any;
  onClearOpenTab?: () => void;
  activePulledOrder?: {
    id: string;
    invoiceNumber: string;
    tableNumber: string;
    customerName: string;
    customerPhone?: string;
    channel: string;
    source: 'OPEN_TAB' | 'QR_MENU';
  } | null;
  onCancelPulledOrder?: () => void;
  occupiedTablesMap?: Record<
    string,
    {
      type: 'OPEN_TAB' | 'QR_ORDER';
      customerName: string;
      grandTotal: number;
      orderId: string;
      invoiceNumber: string;
    }
  >;
  onSelectOccupiedTable?: (orderId: string, type: 'OPEN_TAB' | 'QR_ORDER') => void;
  appliedPromotion?: Promotion | null;
  onOpenPromotionModal?: () => void;
  onRemovePromotion?: () => void;
  /** Callback cetak tiket dapur tanpa harga (KDS Kitchen Check) */
  onPrintKitchenTicket?: () => void;
}

export const OrderCartSidebar: React.FC<OrderCartSidebarProps> = ({
  outlet,
  pointsToRedeem = 0,
  onChangePointsToRedeem,
  cart,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  orderChannel,
  tableNumber,
  onChangeTableNumber,
  onlineOrderId,
  onChangeOnlineOrderId,
  availableTables = [],
  customerName,
  onChangeCustomerName,
  customerPhone: _customerPhone,
  onChangeCustomerPhone,
  selectedCustomer,
  onSelectCustomer,
  customers,
  globalDiscount,
  onChangeGlobalDiscount,
  activeFees,
  onDemandQuantities,
  onOpenOnDemandPicker,
  onHoldOrder,
  onSplitBill,
  onOpenPayment,
  disabledPayment = false,
  currentShift,
  onOpenStartShift,
  onSaveOpenTab,
  activeOpenTab,
  onClearOpenTab,
  activePulledOrder,
  onCancelPulledOrder,
  occupiedTablesMap = {},
  onSelectOccupiedTable,
  appliedPromotion = null,
  onOpenPromotionModal,
  onRemovePromotion,
  onPrintKitchenTicket,
}) => {
  const [showMemberSearch, setShowMemberSearch] = useState(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');

  // Table Search & Filter States
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableSearchTerm, setTableSearchTerm] = useState('');
  const [selectedTableSection, setSelectedTableSection] = useState<string>('ALL');

  const tableSections = Array.from(
    new Set(availableTables.map((t) => t.section).filter(Boolean))
  ) as string[];

  const filteredTables = availableTables.filter((t) => {
    const matchesSection =
      selectedTableSection === 'ALL' || t.section === selectedTableSection;
    const query = tableSearchTerm.toLowerCase().trim();
    if (!query) return matchesSection;
    const matchesQuery =
      t.tableNumber.toLowerCase().includes(query) ||
      (t.name && t.name.toLowerCase().includes(query)) ||
      (t.section && t.section.toLowerCase().includes(query));
    return matchesSection && matchesQuery;
  });

  const selectedTableObj = availableTables.find((t) => t.tableNumber === tableNumber);

  // Helper kalkulasi harga item satuan & subtotal
  const getItemPrice = (item: CartItem) => item.customPrice || item.product.price || item.product.basePrice || 0;
  const getItemSubtotal = (item: CartItem) =>
    Math.max(0, getItemPrice(item) * item.quantity - (item.discountAmount || 0));

  // Perhitungan Subtotal
  const subtotal = cart.reduce((acc, item) => acc + getItemSubtotal(item), 0);

  // Perhitungan Diskon Manual
  const manualDiscountAmount = Math.round((subtotal * globalDiscount) / 100);

  // Perhitungan Diskon Promo / Voucher
  let promoDiscountAmount = 0;
  if (appliedPromotion) {
    if (appliedPromotion.discountType === 'PERCENTAGE') {
      promoDiscountAmount = Math.round((subtotal * appliedPromotion.discountValue) / 100);
      if (appliedPromotion.maxDiscountAmount && Number(appliedPromotion.maxDiscountAmount) > 0) {
        promoDiscountAmount = Math.min(promoDiscountAmount, Number(appliedPromotion.maxDiscountAmount));
      }
    } else {
      promoDiscountAmount = Math.min(subtotal, Number(appliedPromotion.discountValue));
    }
  }

  const totalDiscount = manualDiscountAmount + promoDiscountAmount;
  const totalAfterDiscount = Math.max(0, subtotal - totalDiscount);

  // Perhitungan Biaya On-Demand (Kemasan/Plastik)
  let onDemandFeesTotal = 0;
  activeFees
    .filter((f) => f.category === 'ON_DEMAND_PACKAGING')
    .forEach((f) => {
      const qty = onDemandQuantities[f.id] || 0;
      onDemandFeesTotal += (f.rate || 0) * qty;
    });

  // Perhitungan Biaya Otomatis (Pajak & Service Charge per Kanal)
  let autoFeesTotal = 0;
  const channelActiveFees = activeFees.filter((f) => {
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
  });

  channelActiveFees.forEach((fee) => {
    if (fee.type === 'PERCENTAGE') {
      autoFeesTotal += Math.round((totalAfterDiscount * fee.rate) / 100);
    } else {
      autoFeesTotal += fee.rate;
    }
  });

  // Perhitungan Program Loyalitas & Poin Per-Outlet
  const loyaltyConfig = outlet?.loyaltyConfig;
  const isLoyaltyActive = Boolean(loyaltyConfig?.isActive);
  const pointValueIdr = loyaltyConfig?.pointValueIdr || 100;
  const minPointsToRedeem = loyaltyConfig?.minPointsToRedeem || 0;
  const customerPoints = Number(selectedCustomer?.loyaltyPoints || 0);
  const maxPointsPossible = Math.min(
    customerPoints,
    Math.floor((totalAfterDiscount + onDemandFeesTotal + autoFeesTotal) / pointValueIdr)
  );
  const pointDiscountAmount =
    isLoyaltyActive && pointsToRedeem > 0 ? pointsToRedeem * pointValueIdr : 0;

  const grandTotal = Math.max(
    0,
    totalAfterDiscount + onDemandFeesTotal + autoFeesTotal - pointDiscountAmount
  );
  const totalItemsCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  const filteredMembers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(memberSearchTerm.toLowerCase()) ||
      (c.phone && c.phone.includes(memberSearchTerm))
  );

  return (
    <div className="w-full lg:w-96 xl:w-[400px] bg-white border-l border-slate-200/80 flex flex-col h-full shrink-0 shadow-xs relative">
      {/* Header Keranjang */}
      <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/60">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-blue-900" />
          <h3 className="text-xs sm:text-sm font-black text-slate-900">
            Pesanan Kasir ({totalItemsCount})
          </h3>
        </div>
        {cart.length > 0 && (
          <button
            type="button"
            onClick={onClearCart}
            className="text-[11px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Banner Mode Open Tab Meja Aktif */}
      {activeOpenTab && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between text-xs animate-in fade-in duration-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-900 animate-pulse" />
            {activeOpenTab.queueNumber !== undefined && activeOpenTab.queueNumber !== null && (
              <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-950 font-black text-[10px] border border-amber-300">
                #{String(activeOpenTab.queueNumber).padStart(2, '0')}
              </span>
            )}
            <span className="font-black text-blue-950">
              {activeOpenTab.tableNumber ? `Meja ${activeOpenTab.tableNumber}` : 'Tagihan Meja'}
            </span>
            <span className="text-[10px] text-blue-700 font-mono">
              (#{activeOpenTab.invoiceNumber})
            </span>
          </div>
          {onClearOpenTab && (
            <button
              type="button"
              onClick={onClearOpenTab}
              className="text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-white px-2 py-0.5 rounded-lg border border-rose-200 transition-colors"
            >
              Lepas Tagihan
            </button>
          )}
        </div>
      )}

      {/* Identitas Pelanggan & CRM Member */}
      <div className="p-3 border-b border-slate-100 space-y-2 shrink-0 bg-white">
        {selectedCustomer ? (
          <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-blue-900 text-white flex items-center justify-center font-bold text-xs shrink-0">
                  <UserCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-xs font-bold text-slate-900">{selectedCustomer.name}</p>
                    {selectedCustomer.tier && (
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-black border ${
                        selectedCustomer.tier === 'PLATINUM' ? 'bg-purple-100 text-purple-900 border-purple-300' :
                        selectedCustomer.tier === 'GOLD' ? 'bg-amber-100 text-amber-900 border-amber-300' :
                        selectedCustomer.tier === 'SILVER' ? 'bg-slate-200 text-slate-800 border-slate-300' :
                        'bg-orange-100 text-orange-900 border-orange-300'
                      }`}>
                        {selectedCustomer.tier === 'PLATINUM' ? '💎 PLATINUM' :
                         selectedCustomer.tier === 'GOLD' ? '🥇 GOLD' :
                         selectedCustomer.tier === 'SILVER' ? '🥈 SILVER' : '🥉 BRONZE'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] mt-0.5">
                    <span className="text-slate-500 font-medium">{selectedCustomer.phone || selectedCustomer.email || 'Member'}</span>
                    {isLoyaltyActive && (
                      <span className="font-extrabold text-amber-800 bg-amber-100/80 px-1.5 py-0.2 rounded border border-amber-300">
                        ★ {customerPoints.toLocaleString('id-ID')} Poin
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectCustomer(null);
                  onChangePointsToRedeem?.(0);
                }}
                className="text-[10px] text-slate-500 hover:text-rose-600 font-bold p-1 cursor-pointer"
                title="Lepas Member"
              >
                Lepas
              </button>
            </div>

            {/* Section Tukar Poin Loyalitas (Hanya jika aktif di outlet ini & member punya poin) */}
            {isLoyaltyActive && (
              <div className="pt-2 border-t border-blue-200/60 space-y-1.5">
                {customerPoints === 0 ? (
                  <p className="text-[10px] text-slate-500 italic">
                    Member belum memiliki saldo poin.
                  </p>
                ) : customerPoints < minPointsToRedeem ? (
                  <p className="text-[10px] text-slate-500 italic">
                    Min. penukaran {minPointsToRedeem} poin (Saldo: {customerPoints} poin).
                  </p>
                ) : maxPointsPossible <= 0 ? (
                  <p className="text-[10px] text-slate-500 italic">
                    Tambahkan pesanan untuk mulai menukarkan poin.
                  </p>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-slate-700 flex items-center gap-1">
                        <span>Tukar Poin Diskon</span>
                        <span className="text-[9px] text-slate-400 font-normal">
                          (1 Poin = Rp {pointValueIdr})
                        </span>
                      </span>
                      {pointsToRedeem > 0 && (
                        <span className="text-[10px] font-black text-amber-800">
                          - Rp {(pointsToRedeem * pointValueIdr).toLocaleString('id-ID')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min={0}
                        max={maxPointsPossible}
                        value={pointsToRedeem || ''}
                        onChange={(e) => {
                          const val = Math.max(0, Math.min(maxPointsPossible, Number(e.target.value) || 0));
                          onChangePointsToRedeem?.(val);
                        }}
                        placeholder="0"
                        className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 outline-none focus:border-blue-900"
                      />
                      <div className="flex gap-1 flex-1">
                        <button
                          type="button"
                          onClick={() => onChangePointsToRedeem?.(Math.floor(maxPointsPossible / 2))}
                          className="flex-1 py-1 text-[10px] font-bold bg-white border border-slate-300 hover:bg-slate-100 rounded text-slate-700 transition-colors cursor-pointer"
                        >
                          50%
                        </button>
                        <button
                          type="button"
                          onClick={() => onChangePointsToRedeem?.(maxPointsPossible)}
                          className="flex-1 py-1 text-[10px] font-black bg-amber-500 hover:bg-amber-600 text-slate-950 rounded transition-colors shadow-2xs cursor-pointer"
                        >
                          Semua ({maxPointsPossible})
                        </button>
                        {pointsToRedeem > 0 && (
                          <button
                            type="button"
                            onClick={() => onChangePointsToRedeem?.(0)}
                            className="px-2 py-1 text-[10px] font-bold text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                            title="Batal tukar poin"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Nama Pelanggan (opsional)"
                value={customerName}
                onChange={(e) => onChangeCustomerName(e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-900"
              />
              <button
                type="button"
                onClick={() => setShowMemberSearch(!showMemberSearch)}
                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 shrink-0"
                title="Cari Member CRM"
              >
                <User className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Member</span>
              </button>
            </div>

            {showMemberSearch && (
              <div className="p-2 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-fade-in-up">
                <input
                  type="text"
                  placeholder="Cari nama atau nomor HP..."
                  value={memberSearchTerm}
                  onChange={(e) => setMemberSearchTerm(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs outline-none"
                />
                <div className="max-h-28 overflow-y-auto divide-y divide-slate-100">
                  {filteredMembers.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        onSelectCustomer(m);
                        onChangeCustomerName(m.name);
                        onChangeCustomerPhone(m.phone || '');
                        setShowMemberSearch(false);
                      }}
                      className="p-1.5 hover:bg-blue-50 rounded cursor-pointer text-xs flex justify-between items-center"
                    >
                      <div>
                        <p className="font-bold text-slate-900">{m.name}</p>
                        <p className="text-[10px] text-slate-500">{m.phone || '-'}</p>
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">
                        {m.visitCount || 0}x Kunjungan
                      </span>
                    </div>
                  ))}
                  {filteredMembers.length === 0 && (
                    <p className="text-[11px] text-slate-400 text-center py-1">Member tidak ditemukan</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Contextual Input: Meja untuk Dine In & QR Menu dengan Fitur Pencarian Cepat */}
        {/* Contextual Input: Meja untuk Dine In & QR Menu (Compact Bar - Zero Squish) */}
        {(orderChannel === 'DINE_IN' || orderChannel === 'QR_MENU') && (
          <div className="pt-2 border-t border-slate-100">
            {tableNumber ? (
              <div className="flex items-center justify-between px-2.5 py-1.5 bg-blue-50/80 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-lg bg-blue-900 text-white flex items-center justify-center font-black text-xs shrink-0">
                    {tableNumber}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-blue-950 truncate">
                      Meja {tableNumber} {selectedTableObj?.name ? `(${selectedTableObj.name})` : ''}
                    </p>
                    {selectedTableObj?.section && (
                      <p className="text-[10px] text-blue-700 font-semibold truncate">
                        {selectedTableObj.section} {selectedTableObj.capacity ? `• ${selectedTableObj.capacity} Kursi` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTablePicker(true);
                      setTableSearchTerm('');
                    }}
                    className="text-[10px] font-bold text-blue-900 hover:text-blue-800 bg-blue-100/70 hover:bg-blue-100 px-2 py-0.5 rounded-lg border border-blue-200 transition-colors cursor-pointer"
                  >
                    Ganti
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onChangeTableNumber?.('');
                      setShowTablePicker(false);
                    }}
                    className="text-[11px] font-bold text-slate-400 hover:text-rose-600 px-1 cursor-pointer"
                    title="Hapus nomor meja"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ) : availableTables.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setShowTablePicker(true);
                  setTableSearchTerm('');
                }}
                className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-50 hover:bg-blue-50/60 border border-dashed border-slate-300 hover:border-blue-400 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">🍽️</span>
                  <span>Nomor Meja: <span className="text-slate-400 font-normal">Belum Dipilih</span></span>
                </div>
                <span className="text-[10px] font-bold text-blue-900 bg-blue-100/70 px-2 py-0.5 rounded-md flex items-center gap-1">
                  Pilih Meja ▾
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Nomor Meja (mis: 01, B-2)..."
                  value={tableNumber || ''}
                  onChange={(e) => onChangeTableNumber?.(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-blue-950 placeholder:text-slate-400 focus:outline-none focus:border-blue-900"
                />
                {tableNumber && (
                  <button
                    type="button"
                    onClick={() => onChangeTableNumber?.('')}
                    className="text-[10px] text-slate-400 hover:text-rose-600 font-bold px-1 cursor-pointer"
                    title="Hapus nomor meja"
                  >
                    Reset
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Floating Table Picker Overlay Popover (Zero Squish to Order List) */}
        {showTablePicker && availableTables.length > 0 && (
          <>
            {/* Backdrop click to dismiss */}
            <div
              onClick={() => {
                setShowTablePicker(false);
                setTableSearchTerm('');
              }}
              className="fixed inset-0 z-30 bg-slate-950/20 backdrop-blur-2xs"
            />

            <div className="absolute inset-x-2 top-20 z-40 bg-white border border-slate-300 rounded-2xl shadow-2xl p-3 flex flex-col space-y-2 animate-in fade-in zoom-in-95 duration-150">
              {/* Header with Close Button */}
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-blue-900" />
                  <span>Pilih Meja Resto</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowTablePicker(false);
                    setTableSearchTerm('');
                  }}
                  className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search Box with icon */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Ketik cari meja... (cth: 01, VIP, Teras)"
                  value={tableSearchTerm}
                  onChange={(e) => setTableSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filteredTables.length === 1) {
                        onChangeTableNumber?.(filteredTables[0].tableNumber);
                        setShowTablePicker(false);
                        setTableSearchTerm('');
                      } else if (tableSearchTerm.trim()) {
                        onChangeTableNumber?.(tableSearchTerm.trim());
                        setShowTablePicker(false);
                        setTableSearchTerm('');
                      }
                    } else if (e.key === 'Escape') {
                      setShowTablePicker(false);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-blue-900 focus:bg-white rounded-xl pl-8 pr-7 py-1.5 text-xs font-bold text-blue-950 outline-none"
                />
                {tableSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setTableSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Section filter pills if multiple sections exist */}
              {tableSections.length > 1 && (
                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setSelectedTableSection('ALL')}
                    className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      selectedTableSection === 'ALL'
                        ? 'bg-blue-900 text-white'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Semua ({availableTables.length})
                  </button>
                  {tableSections.map((sec) => {
                    const count = availableTables.filter((t) => t.section === sec).length;
                    return (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setSelectedTableSection(sec)}
                        className={`px-2 py-0.5 rounded-md font-bold whitespace-nowrap transition-colors cursor-pointer ${
                          selectedTableSection === sec
                            ? 'bg-blue-900 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {sec} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Quick Selection Grid */}
              <div className="max-h-56 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-1.5 pr-0.5">
                {filteredTables.map((t) => {
                  const isSelected = tableNumber === t.tableNumber;
                  const occupancy = occupiedTablesMap[t.tableNumber];
                  const isOccupiedByAnother = Boolean(
                    occupancy && (!activePulledOrder || activePulledOrder.tableNumber !== t.tableNumber)
                  );

                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        if (!isOccupiedByAnother) {
                          onChangeTableNumber?.(t.tableNumber);
                          setShowTablePicker(false);
                          setTableSearchTerm('');
                        }
                      }}
                      className={`p-2 rounded-xl border text-left transition-all flex flex-col justify-between relative ${
                        isOccupiedByAnother ? 'cursor-default' : 'cursor-pointer'
                      } ${
                        isSelected
                          ? 'bg-blue-900 border-blue-900 text-white shadow-xs'
                          : isOccupiedByAnother
                          ? 'bg-amber-50/90 border-amber-300 text-amber-950'
                          : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`text-xs font-black ${
                            isSelected ? 'text-white' : isOccupiedByAnother ? 'text-amber-950' : 'text-blue-950'
                          }`}
                        >
                          Meja {t.tableNumber}
                        </span>
                        {isSelected ? (
                          <Check className="w-3 h-3 text-emerald-300" />
                        ) : isOccupiedByAnother ? (
                          <span className="text-[8px] font-black uppercase px-1 py-0.2 rounded bg-amber-200 text-amber-900 border border-amber-300">
                            Terisi
                          </span>
                        ) : (
                          <span className="text-[8px] font-bold text-emerald-700 bg-emerald-100/70 px-1 py-0.2 rounded border border-emerald-200">
                            Kosong
                          </span>
                        )}
                      </div>

                      {isOccupiedByAnother && occupancy ? (
                        <div className="mt-1 pt-1 border-t border-amber-200">
                          <p className="text-[9px] font-bold text-amber-900 truncate">
                            {occupancy.customerName || 'Tamu'}
                          </p>
                          <p className="text-[9px] font-black text-amber-800">
                            Rp {Number(occupancy.grandTotal || 0).toLocaleString('id-ID')}
                          </p>
                          {onSelectOccupiedTable && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowTablePicker(false);
                                onSelectOccupiedTable(occupancy.orderId, occupancy.type);
                              }}
                              className="mt-1 w-full text-center text-[9px] font-bold text-white bg-amber-800 hover:bg-amber-900 py-0.5 rounded-md transition-colors cursor-pointer"
                              title="Tarik tagihan meja ini ke kasir"
                            >
                              Tarik Tagihan ➔
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full mt-1">
                          <span
                            className={`text-[9px] truncate max-w-[55px] font-medium ${
                              isSelected ? 'text-blue-200' : 'text-slate-500'
                            }`}
                          >
                            {t.section || t.name || 'Resto'}
                          </span>
                          {t.capacity && (
                            <span
                              className={`text-[8px] font-bold px-1 rounded ${
                                isSelected ? 'bg-blue-800 text-blue-100' : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {t.capacity}P
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Option to use custom/manual table if typed query doesn't match */}
              {tableSearchTerm.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    onChangeTableNumber?.(tableSearchTerm.trim());
                    setShowTablePicker(false);
                    setTableSearchTerm('');
                  }}
                  className="w-full py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>➕ Gunakan Meja "{tableSearchTerm.trim()}" (Manual)</span>
                </button>
              )}

              {filteredTables.length === 0 && !tableSearchTerm && (
                <p className="text-center py-2 text-xs text-slate-400">Tidak ada meja pada zona ini</p>
              )}
            </div>
          </>
        )}

        {/* Contextual Input: ID Pesanan Online Driver untuk Mitra Online Delivery */}
        {((['GOFOOD', 'GRABFOOD', 'SHOPEEFOOD'] as string[]).includes(orderChannel) ||
          (orderChannel !== 'DINE_IN' &&
            orderChannel !== 'TAKEAWAY' &&
            orderChannel !== 'DELIVERY' &&
            orderChannel !== 'QR_MENU')) && (
          <div className="pt-2 border-t border-blue-100 bg-blue-50/50 p-2.5 rounded-2xl space-y-1.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-blue-900 flex items-center gap-1.5">
                <Bike className="w-3.5 h-3.5 text-blue-900" />
                <span>
                  ID Pesanan Mitra ({ORDER_CHANNEL_LABELS[orderChannel]?.label || orderChannel}):
                </span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200">
                Online Driver
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="No. Pesanan Driver (e.g. #GF-402, #GRAB-108)"
                value={onlineOrderId || ''}
                onChange={(e) => onChangeOnlineOrderId?.(e.target.value)}
                className="flex-1 bg-white border border-blue-300 rounded-xl px-3 py-1.5 text-xs font-black text-blue-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-900 font-mono tracking-wide"
              />
              {onlineOrderId && (
                <button
                  type="button"
                  onClick={() => onChangeOnlineOrderId?.('')}
                  className="text-[10px] text-slate-400 hover:text-rose-600 font-bold px-1 cursor-pointer"
                  title="Hapus ID pesanan"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        )}

        {/* Contextual Input: Kurir Toko Internal */}
        {orderChannel === 'DELIVERY' && (
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-600 shrink-0">🛵 Pengantaran:</span>
            <input
              type="text"
              placeholder="Alamat / Catatan Pengantaran"
              value={onlineOrderId || ''}
              onChange={(e) => onChangeOnlineOrderId?.(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-900"
            />
          </div>
        )}

        {/* Contextual Note: Takeaway */}
        {orderChannel === 'TAKEAWAY' && (
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
            <span>🥡 Bawa Pulang (Take Away)</span>
            <span className="font-bold text-orange-600">Pelanggan ambil di konter</span>
          </div>
        )}
      </div>

      {/* Banner Pesanan Meja / QR yang Sedang Ditarik Kasir */}
      {activePulledOrder && (
        <div className="mx-3 mt-2 mb-1 p-2.5 bg-blue-50/90 border border-blue-200 rounded-xl flex items-center justify-between gap-2 text-xs animate-in fade-in duration-150">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 font-black text-blue-950">
              <span className="text-sm">🍽️</span>
              <span className="truncate">Meja {activePulledOrder.tableNumber}</span>
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-200 text-blue-900 shrink-0">
                {activePulledOrder.source === 'QR_MENU' ? 'Pesanan QR' : 'Tagihan Terbuka'}
              </span>
            </div>
            <p className="text-[10px] text-blue-700 truncate mt-0.5">
              #{activePulledOrder.invoiceNumber} • {activePulledOrder.customerName || 'Tamu'}
            </p>
          </div>
          {onCancelPulledOrder && (
            <button
              type="button"
              onClick={onCancelPulledOrder}
              className="px-2 py-1 bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-700 border border-slate-200 hover:border-rose-300 font-bold rounded-lg text-[10px] transition-colors shrink-0 cursor-pointer shadow-2xs"
              title="Kembalikan pesanan ke antrean semula tanpa mengubah data"
            >
              ↩️ Batal Tarik
            </button>
          )}
        </div>
      )}

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 divide-y divide-slate-100">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <ShoppingCart className="w-10 h-10 mb-2 stroke-[1.5] text-slate-300" />
            <p className="text-xs font-bold text-slate-600">Keranjang Belanja Masih Kosong</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Pilih menu dari katalog di sebelah kiri untuk memulai pesanan kasir.
            </p>
          </div>
        ) : (
          cart.map((item, idx) => (
            <div key={`${item.product.id}-${item.cartItemId || idx}`} className="pt-2 first:pt-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-slate-900 leading-tight truncate">
                    {item.product.name}
                  </h4>
                  {item.product.category && (
                    <p className="text-[10px] text-blue-900 font-semibold">{item.product.category.name}</p>
                  )}
                  {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                    <div className="mt-1 space-y-0.5">
                      {item.selectedModifiers.map((m, mIdx) => (
                        <p key={mIdx} className="text-[10px] text-slate-500 flex justify-between">
                          <span>+ {m.option?.name || m.groupName}</span>
                          <span>Rp {(m.option?.priceDelta || 0).toLocaleString('id-ID')}</span>
                        </p>
                      ))}
                    </div>
                  )}
                  {item.itemNote && (
                    <p className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded mt-1 font-medium inline-block">
                      Catatan: {item.itemNote}
                    </p>
                  )}
                  <p className="text-xs font-black text-slate-900 mt-1">
                    Rp {getItemSubtotal(item).toLocaleString('id-ID')}
                  </p>
                </div>

                {/* Qty Stepper & Remove */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (item.quantity <= 1) {
                        onRemoveItem(idx);
                      } else {
                        onUpdateQuantity(idx, -1);
                      }
                    }}
                    className="w-6 h-6 rounded-lg bg-white text-slate-700 flex items-center justify-center hover:bg-slate-200 transition-colors shadow-2xs"
                  >
                    {item.quantity <= 1 ? <Trash2 className="w-3 h-3 text-rose-600" /> : <Minus className="w-3 h-3" />}
                  </button>
                  <span className="w-6 text-center text-xs font-black text-slate-900">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(idx, 1)}
                    className="w-6 h-6 rounded-lg bg-blue-900 text-white flex items-center justify-center hover:bg-blue-800 transition-colors shadow-2xs"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Bill Calculation & Summary */}
      <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 space-y-3">
        {/* Diskon, Voucher & Kemasan Trigger Bar */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
              <PercentCircle className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px] text-slate-500 font-medium">Diskon:</span>
              <input
                type="number"
                min="0"
                max="100"
                value={globalDiscount || ''}
                onChange={(e) => onChangeGlobalDiscount(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-10 text-right font-black text-slate-900 outline-none text-xs"
              />
              <span className="text-xs font-bold text-slate-500">%</span>
            </div>

            {onOpenPromotionModal && (
              <button
                type="button"
                onClick={onOpenPromotionModal}
                className={`px-2.5 py-1.5 border rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                  appliedPromotion
                    ? 'bg-blue-50 border-blue-300 text-blue-900 shadow-2xs'
                    : 'bg-white hover:bg-slate-100 border-slate-200 text-slate-700'
                }`}
                title="Pilih Voucher Promosi & Kupon"
              >
                <Ticket className="w-3.5 h-3.5 text-blue-900" />
                <span className="text-[11px]">{appliedPromotion ? appliedPromotion.code : 'Voucher'}</span>
              </button>
            )}

            {onOpenOnDemandPicker && (
              <button
                type="button"
                onClick={onOpenOnDemandPicker}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-1 transition-colors"
                title="Pilih Kantong Plastik / Kemasan Tambahan"
              >
                <Package className="w-3.5 h-3.5 text-blue-900" />
                <span className="text-[11px]">Kemasan</span>
                {onDemandFeesTotal > 0 && (
                  <span className="w-2 h-2 rounded-full bg-blue-900" />
                )}
              </button>
            )}
          </div>

          {/* Active Applied Voucher Pill */}
          {appliedPromotion && (
            <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs">
              <div className="flex items-center gap-1.5 truncate">
                <Ticket className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="font-bold truncate">{appliedPromotion.code}</span>
                <span className="text-[10px] text-emerald-700 font-semibold truncate">
                  ({appliedPromotion.discountType === 'PERCENTAGE'
                    ? `Diskon ${appliedPromotion.discountValue}%`
                    : `Hemat Rp ${Number(appliedPromotion.discountValue).toLocaleString('id-ID')}`})
                </span>
              </div>
              {onRemovePromotion && (
                <button
                  type="button"
                  onClick={onRemovePromotion}
                  className="text-emerald-700 hover:text-emerald-950 p-0.5 rounded-md hover:bg-emerald-100 transition-colors ml-1 shrink-0"
                  title="Hapus kupon promo"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Breakdown Items */}
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal Pesanan</span>
            <span className="font-bold text-slate-900">Rp {subtotal.toLocaleString('id-ID')}</span>
          </div>

          {manualDiscountAmount > 0 && (
            <div className="flex justify-between text-rose-600 font-medium">
              <span>Diskon Manual ({globalDiscount}%)</span>
              <span>- Rp {manualDiscountAmount.toLocaleString('id-ID')}</span>
            </div>
          )}

          {promoDiscountAmount > 0 && (
            <div className="flex justify-between text-emerald-700 font-bold">
              <span>Voucher Promo ({appliedPromotion?.code})</span>
              <span>- Rp {promoDiscountAmount.toLocaleString('id-ID')}</span>
            </div>
          )}

          {pointDiscountAmount > 0 && (
            <div className="flex justify-between text-amber-800 font-bold">
              <span>Tukar Poin ({pointsToRedeem} Poin)</span>
              <span>- Rp {pointDiscountAmount.toLocaleString('id-ID')}</span>
            </div>
          )}

          {onDemandFeesTotal > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Kemasan &amp; Kantong</span>
              <span>Rp {onDemandFeesTotal.toLocaleString('id-ID')}</span>
            </div>
          )}

          {channelActiveFees.map((fee) => {
            const calculated =
              fee.type === 'PERCENTAGE'
                ? Math.round((totalAfterDiscount * fee.rate) / 100)
                : fee.rate;
            return (
              <div key={fee.id} className="flex justify-between text-slate-500 text-[11px]">
                <span>
                  {fee.name} ({fee.type === 'PERCENTAGE' ? `${fee.rate}%` : 'Tetap'})
                </span>
                <span>Rp {calculated.toLocaleString('id-ID')}</span>
              </div>
            );
          })}

          <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
            <span className="text-xs font-black text-slate-900 uppercase tracking-wider">
              Total Tagihan
            </span>
            <span className="text-xl font-black text-blue-900 tracking-tight">
              Rp {grandTotal.toLocaleString('id-ID')}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          {/* Shift Closed Warning Indicator */}
          {!currentShift && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-2 text-xs text-amber-900 animate-in fade-in duration-100">
              <div className="flex items-center gap-1.5 font-bold">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Shift belum dibuka</span>
              </div>
              {onOpenStartShift && (
                <button
                  type="button"
                  onClick={onOpenStartShift}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-[11px] transition-colors shadow-xs cursor-pointer shrink-0"
                >
                  Buka Shift
                </button>
              )}
            </div>
          )}

          {/* Primary Payment Button */}
          <Button
            variant="primary"
            size="lg"
            icon={<CreditCard className="w-4 h-4" />}
            disabled={cart.length === 0 || disabledPayment}
            onClick={onOpenPayment}
            className="w-full text-sm font-black shadow-md shadow-blue-900/20"
          >
            {activePulledOrder || activeOpenTab
              ? `Pelunasan Meja (Rp ${grandTotal.toLocaleString('id-ID')})`
              : (orderChannel === 'DINE_IN' || orderChannel === 'QR_MENU')
              ? `Bayar Langsung (Rp ${grandTotal.toLocaleString('id-ID')})`
              : `Bayar Sekarang (Rp ${grandTotal.toLocaleString('id-ID')})`}
          </Button>

          {/* Secondary Action: Simpan & Kirim Dapur (Bayar Nanti / Perbarui Tagihan Meja) */}
          {(orderChannel === 'DINE_IN' || orderChannel === 'QR_MENU') && onSaveOpenTab && (
            <Button
              variant="outline"
              size="md"
              icon={<UtensilsCrossed className="w-4 h-4 text-blue-900" />}
              disabled={cart.length === 0 || !currentShift}
              onClick={onSaveOpenTab}
              className="w-full text-xs font-bold border-blue-200 text-blue-950 hover:bg-blue-50/80 bg-blue-50/40"
              title={
                activePulledOrder || activeOpenTab
                  ? 'Simpan perubahan pesanan tambahan ke tagihan meja ini'
                  : 'Simpan pesanan meja untuk dibayar nanti saat pelanggan selesai makan'
              }
            >
              {activePulledOrder || activeOpenTab
                ? 'Perbarui Tagihan Meja (Simpan ke Dapur)'
                : 'Simpan & Kirim Dapur (Bayar Nanti)'}
            </Button>
          )}

          {/* Kitchen Ticket Print (KDS) — Tombol cetak tiket dapur tanpa harga */}
          {(orderChannel === 'DINE_IN' || orderChannel === 'QR_MENU') && onPrintKitchenTicket && cart.length > 0 && (
            <button
              type="button"
              onClick={onPrintKitchenTicket}
              title="Cetak tiket pesanan ke printer dapur (tanpa harga)"
              className="w-full py-2 px-3 rounded-xl border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>Cetak Tiket Dapur (KDS)</span>
              <Printer className="w-3.5 h-3.5 ml-auto opacity-50" />
            </button>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              icon={<PauseCircle className="w-3.5 h-3.5 text-amber-600" />}
              disabled={cart.length === 0 || !currentShift}
              onClick={onHoldOrder}
              className="w-full text-xs"
            >
              Tahan Antrean
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Split className="w-3.5 h-3.5 text-indigo-600" />}
              disabled={cart.length === 0 || !currentShift}
              onClick={onSplitBill}
              className="w-full text-xs"
            >
              Split Bill
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
