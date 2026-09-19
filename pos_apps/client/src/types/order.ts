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

export type OrderChannel = 'DINE_IN' | 'TAKEAWAY' | 'GOFOOD' | 'GRABFOOD' | 'SHOPEEFOOD' | 'DELIVERY';

export const ORDER_CHANNEL_LABELS: Record<OrderChannel, { label: string; badge: string; color: string; bg: string }> = {
  DINE_IN: { label: 'Dine In', badge: 'Makan di Tempat', color: '#16a34a', bg: '#dcfce7' },
  TAKEAWAY: { label: 'Takeaway', badge: 'Bawa Pulang', color: '#ea580c', bg: '#ffedd5' },
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
  shiftId?: string;
  outletId?: string;
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
  amountPaid: number;
  changeGiven: number;
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
  taxAmount: number;
  serviceCharge: number;
  grandTotal: number;
  channel?: OrderChannel | string;
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
