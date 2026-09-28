import type { Product } from './product';

export interface CartItem {
  cartItemId?: string; // unique key for items with different modifiers
  product: Product;
  quantity: number;
  discountAmount: number;
  selectedModifiers?: { groupName: string; option: any }[];
  itemNote?: string;
  customPrice?: number;
}

export type PaymentMethodType = 'CASH' | 'QRIS' | 'DEBIT' | 'CREDIT' | 'TRANSFER' | 'SPLIT';

export type OrderChannel = 'DINE_IN' | 'TAKEAWAY' | 'QR_MENU' | 'GOFOOD' | 'GRABFOOD' | 'SHOPEEFOOD' | 'DELIVERY';

export const ORDER_CHANNEL_LABELS: Record<OrderChannel, { label: string; badge: string; color: string; bg: string }> = {
  DINE_IN: { label: 'Dine In', badge: 'Makan di Tempat', color: '#16a34a', bg: '#dcfce7' },
  TAKEAWAY: { label: 'Takeaway', badge: 'Bawa Pulang', color: '#ea580c', bg: '#ffedd5' },
  QR_MENU: { label: 'QR Meja', badge: 'Pesan Mandiri QR', color: '#7c3aed', bg: '#f3e8ff' },
  GOFOOD: { label: 'GoFood', badge: 'GoFood Online', color: '#dc2626', bg: '#fee2e2' },
  GRABFOOD: { label: 'GrabFood', badge: 'GrabFood Online', color: '#15803d', bg: '#bbf7d0' },
  SHOPEEFOOD: { label: 'ShopeeFood', badge: 'ShopeeFood Online', color: '#ea580c', bg: '#ffedd5' },
  DELIVERY: { label: 'Kurir / Delivery', badge: 'Antar Toko', color: '#2563eb', bg: '#dbeafe' },
};

export interface PaymentPayload {
  method: PaymentMethodType;
  amountPaid: number;
  changeGiven?: number;
  qrisReference?: string;
}

export interface CheckoutPayload {
  items: {
    productId: string;
    quantity: number;
    discountAmount?: number;
  }[];
  channel?: OrderChannel | string;
  tableNumber?: string;
  onlineOrderId?: string;
  notes?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  discountAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  serviceCharge?: number;
  payment?: PaymentPayload;
  payments?: PaymentPayload[];
  existingOrderId?: string;
  shiftId?: string;
  outletId?: string;
  promotionId?: string;
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  costPrice: number;
  unitPrice: number;
  discountAmount: number;
  subtotal: number;
  product: {
    name: string;
    sku?: string;
    barcode?: string;
    unit: string;
  };
}

export interface Payment {
  id: string;
  method: string;
  paymentMethod?: string;
  amountPaid: number;
  amount?: number;
  changeGiven?: number;
  qrisReference?: string | null;
  status: string;
  createdAt: string;
}

export interface Order {
  id: string;
  invoiceNumber: string;
  outletId: string;
  cashierId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  customerId?: string | null;
  customer?: {
    id: string;
    name: string;
    code?: string | null;
    phone?: string | null;
  } | null;
  subtotal: number;
  discountAmount: number;
  discountTotal?: number;
  taxAmount: number;
  taxTotal?: number;
  serviceCharge: number;
  serviceTotal?: number;
  grandTotal: number;
  totalAmount?: number;
  channel?: OrderChannel | string;
  orderType?: string;
  paymentStatus: string;
  createdAt: string;
  orderItems: OrderItem[];
  payments: Payment[];
  outlet?: {
    name: string;
    address: string | null;
    phone: string | null;
    receiptConfig?: {
      paperSize: '58mm' | '80mm';
      footerText?: string;
    } | null;
  };
  cashier?: {
    name: string;
  };
}

export interface HoldOrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  note?: string;
}

export interface HoldOrder {
  id: string;
  outletId: string;
  cashierId: string;
  customerName?: string | null;
  channel?: OrderChannel | string;
  note?: string | null;
  items: HoldOrderItem[];
  totalAmount: number;
  createdAt: string;
  cashier?: {
    name: string;
  };
}

export interface OpenTabOrderItem {
  id: string;
  productId: string;
  variantId?: string | null;
  productName: string;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  subtotal: number;
  notes?: string | null;
}

export interface OpenTabOrder {
  id: string;
  invoiceNumber: string;
  outletId: string;
  cashierId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  channel?: OrderChannel | string;
  tableNumber?: string | null;
  notes?: string | null;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  serviceCharge: number;
  grandTotal: number;
  orderStatus: string;
  paymentStatus: string;
  createdAt: string;
  cashier?: {
    name: string;
  };
  items: OpenTabOrderItem[];
}

export interface OpenTabPayload {
  items: {
    productId: string;
    quantity: number;
    discountAmount?: number;
    notes?: string;
  }[];
  channel?: OrderChannel | string;
  tableNumber?: string;
  customerName?: string;
  customerPhone?: string;
  customerId?: string;
  notes?: string;
  discountAmount?: number;
  taxRate?: number;
  taxAmount?: number;
  serviceCharge?: number;
  outletId?: string;
  shiftId?: string;
  existingOrderId?: string | null;
}
