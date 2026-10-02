export interface QrTable {
  id: string;
  tenantId: string;
  outletId: string;
  tableNumber: string;
  name: string;
  section: string;
  capacity: number;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED';
  qrSlug: string;
  createdAt: string;
  updatedAt: string;
}

export interface QrMenuSettings {
  tenantId: string;
  outletId: string;
  selfOrderingEnabled: boolean;
  welcomeTitle: string;
  welcomeSubtitle: string;
  wifiEnabled?: boolean;
  wifiName?: string;
  wifiPassword?: string;
  paymentPolicy: 'PAY_AT_CASHIER';
  showEstimatedTime: boolean;
  estimatedPrepMinutes: number;
  bannerUrl?: string;
  updatedAt: string;
}

export interface QrOrderItem {
  id: string;
  productId?: string;
  variantId?: string;
  productName: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  notes?: string;
}

export interface QrLiveOrder {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  subtotal: number;
  taxAmount: number;
  serviceCharge: number;
  grandTotal: number;
  orderStatus: 'CONFIRMED' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'CANCELLED' | 'VOIDED';
  paymentStatus: 'UNPAID' | 'PAID' | 'PARTIALLY_PAID';
  tableNumber: string;
  notes?: string;
  customerName: string;
  customerPhone?: string;
  items: QrOrderItem[];
}

import type { ProductModifierGroup } from './product';

export interface PublicMenuProduct {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  categoryName: string;
  minPrice: number;
  variants: Array<{
    id: string;
    name: string;
    price: number;
    sku?: string;
  }>;
  modifiers?: ProductModifierGroup[];
}

export interface PublicMenuResponse {
  outlet: {
    id: string;
    name: string;
    address?: string;
    phone?: string;
    tenantName: string;
    feesConfig?: any;
  };
  settings: QrMenuSettings;
  table?: QrTable | null;
  /** Apakah meja sedang aktif dipakai tamu lain */
  tableOccupied?: boolean;
  /** Info tagihan aktif jika meja terisi */
  activeOrderInfo?: {
    invoiceNumber: string;
    customerName: string;
    channel: string;
  } | null;
  categories: string[];
  products: PublicMenuProduct[];
}
