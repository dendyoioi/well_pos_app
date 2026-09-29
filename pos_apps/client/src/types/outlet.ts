export type FeeType = 'PERCENTAGE' | 'FIXED';

export type FeeChannelScope =
  | 'ALL'
  | 'DINE_IN'
  | 'TAKEAWAY'
  | 'GOFOOD'
  | 'GRABFOOD'
  | 'SHOPEEFOOD'
  | 'DELIVERY'
  | 'ONLINE_DELIVERY';

export type FeeCategory = 'DEFAULT_TAX_SERVICE' | 'ON_DEMAND_PACKAGING';

export interface OutletFee {
  id: string;
  name: string;
  type: FeeType;
  rate: number; // Persentase (misal: 10 untuk 10%) atau Rupiah Tetap (misal: 2000 untuk Rp 2.000)
  channelScope: FeeChannelScope;
  isActive: boolean;
  category?: FeeCategory;
  isQuickAccess?: boolean; // Tampil langsung di 4 tombol akses cepat keranjang kasir
}

export const DEFAULT_OUTLET_FEES: OutletFee[] = [
  {
    id: 'fee_tax',
    name: 'PPN / PB1 Pajak Restoran',
    type: 'PERCENTAGE',
    rate: 10,
    channelScope: 'ALL',
    isActive: false,
    category: 'DEFAULT_TAX_SERVICE',
  },
  {
    id: 'fee_service',
    name: 'Biaya Layanan Meja',
    type: 'PERCENTAGE',
    rate: 5,
    channelScope: 'DINE_IN',
    isActive: false,
    category: 'DEFAULT_TAX_SERVICE',
  },
  {
    id: 'fee_delivery',
    name: 'Ongkir Kurir Toko',
    type: 'FIXED',
    rate: 10000,
    channelScope: 'DELIVERY',
    isActive: false,
    category: 'DEFAULT_TAX_SERVICE',
  },
  {
    id: 'fee_online',
    name: 'Biaya Platform Online',
    type: 'FIXED',
    rate: 3000,
    channelScope: 'ONLINE_DELIVERY',
    isActive: false,
    category: 'DEFAULT_TAX_SERVICE',
  },
  {
    id: 'fee_plastic_s',
    name: 'Plastik / Kresek Sedang',
    type: 'FIXED',
    rate: 500,
    channelScope: 'ALL',
    isActive: false,
    category: 'ON_DEMAND_PACKAGING',
    isQuickAccess: false,
  },
  {
    id: 'fee_box',
    name: 'Box Kemasan / Mika',
    type: 'FIXED',
    rate: 2000,
    channelScope: 'ALL',
    isActive: false,
    category: 'ON_DEMAND_PACKAGING',
    isQuickAccess: false,
  },
  {
    id: 'fee_paperbag',
    name: 'Paper Bag Kraft',
    type: 'FIXED',
    rate: 3000,
    channelScope: 'ALL',
    isActive: false,
    category: 'ON_DEMAND_PACKAGING',
    isQuickAccess: false,
  },
  {
    id: 'fee_cutlery',
    name: 'Set Sendok & Garpu Higienis',
    type: 'FIXED',
    rate: 1000,
    channelScope: 'ALL',
    isActive: false,
    category: 'ON_DEMAND_PACKAGING',
    isQuickAccess: false,
  },
];

export function normalizeOutletFees(savedFees?: OutletFee[] | null): OutletFee[] {
  if (!savedFees || !Array.isArray(savedFees) || savedFees.length === 0) {
    return DEFAULT_OUTLET_FEES;
  }

  const result: OutletFee[] = [];

  for (const saved of savedFees) {
    let category = saved.category;
    if (!category) {
      const isTaxOrService =
        saved.type === 'PERCENTAGE' ||
        saved.id === 'fee_tax' ||
        saved.id === 'fee_service' ||
        saved.name.toLowerCase().includes('pajak') ||
        saved.name.toLowerCase().includes('pb1') ||
        saved.name.toLowerCase().includes('layanan');
      category = isTaxOrService ? 'DEFAULT_TAX_SERVICE' : 'ON_DEMAND_PACKAGING';
    }

    result.push({
      ...saved,
      category,
      isQuickAccess: saved.isQuickAccess ?? (category === 'ON_DEMAND_PACKAGING'),
    });
  }

  return result;
}

export interface ReceiptConfig {
  paperSize: '58mm' | '80mm';
  footerText?: string;
  showQueueNumber?: boolean;
}

export interface SalesChannelConfig {
  id: string;
  code: string;
  name: string;
  group: 'OFFLINE_DIRECT' | 'ONLINE_DELIVERY';
  isActive: boolean;
  color?: string;
  badge?: string;
  requiresTable?: boolean;
  requiresOnlineOrderId?: boolean;
  isCustom?: boolean;
}

export const DEFAULT_SALES_CHANNELS: SalesChannelConfig[] = [
  {
    id: 'channel_dine_in',
    code: 'DINE_IN',
    name: 'Makan di Tempat (Dine In)',
    group: 'OFFLINE_DIRECT',
    isActive: true,
    color: '#16a34a',
    badge: 'Makan di Meja',
    requiresTable: true,
    requiresOnlineOrderId: false,
    isCustom: false,
  },
  {
    id: 'channel_takeaway',
    code: 'TAKEAWAY',
    name: 'Bawa Pulang (Take Away)',
    group: 'OFFLINE_DIRECT',
    isActive: true,
    color: '#ea580c',
    badge: 'Bawa Pulang',
    requiresTable: false,
    requiresOnlineOrderId: false,
    isCustom: false,
  },
  {
    id: 'channel_delivery',
    code: 'DELIVERY',
    name: 'Kurir Toko (In-House Delivery)',
    group: 'OFFLINE_DIRECT',
    isActive: false,
    color: '#2563eb',
    badge: 'Kurir Internal',
    requiresTable: false,
    requiresOnlineOrderId: false,
    isCustom: false,
  },
  {
    id: 'channel_gofood',
    code: 'GOFOOD',
    name: 'GoFood',
    group: 'ONLINE_DELIVERY',
    isActive: false,
    color: '#dc2626',
    badge: 'Mitra Gojek',
    requiresTable: false,
    requiresOnlineOrderId: true,
    isCustom: false,
  },
  {
    id: 'channel_grabfood',
    code: 'GRABFOOD',
    name: 'GrabFood',
    group: 'ONLINE_DELIVERY',
    isActive: false,
    color: '#15803d',
    badge: 'Mitra Grab',
    requiresTable: false,
    requiresOnlineOrderId: true,
    isCustom: false,
  },
  {
    id: 'channel_shopeefood',
    code: 'SHOPEEFOOD',
    name: 'ShopeeFood',
    group: 'ONLINE_DELIVERY',
    isActive: false,
    color: '#ea580c',
    badge: 'Mitra Shopee',
    requiresTable: false,
    requiresOnlineOrderId: true,
    isCustom: false,
  },
];

export interface QrisConfig {
  imageUrl?: string | null;
  nmid?: string | null;
  merchantName?: string | null;
  bankName?: string | null;
  isActive: boolean;
}

export interface PaymentConfig {
  qris?: QrisConfig | null;
}

export interface Outlet {
  id: string;
  tenantId?: string | null;
  name: string;
  merchantName?: string | null;
  address?: string | null;
  phone?: string | null;
  isWarehouse?: boolean;
  warehouseId?: string | null;
  warehouse?: Outlet | null;
  feesConfig?: OutletFee[] | null;
  receiptConfig?: ReceiptConfig | null;
  channelsConfig?: SalesChannelConfig[] | null;
  paymentConfig?: PaymentConfig | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    users?: number;
    orders?: number;
    outletProducts?: number;
  };
}

/**
 * Normalizes channels to guarantee all standard core channels (DINE_IN, TAKEAWAY, DELIVERY, GOFOOD, GRABFOOD, SHOPEEFOOD)
 * are always present even if an outlet has a partial or legacy JSON configuration.
 */
export function normalizeSalesChannels(savedChannels?: SalesChannelConfig[] | null): SalesChannelConfig[] {
  if (!savedChannels || !Array.isArray(savedChannels) || savedChannels.length === 0) {
    return DEFAULT_SALES_CHANNELS;
  }

  const result: SalesChannelConfig[] = [];
  const processedCodes = new Set<string>();

  // 1. Process standard default channels: merge user preferences while guaranteeing their presence
  for (const def of DEFAULT_SALES_CHANNELS) {
    const saved = savedChannels.find((s) => s.code === def.code || s.id === def.id);
    if (saved) {
      result.push({
        ...def,
        ...saved,
        name: saved.name || def.name,
        group: def.group,
        requiresTable: def.requiresTable,
        requiresOnlineOrderId: def.requiresOnlineOrderId,
      });
      processedCodes.add(def.code);
      if (saved.code) processedCodes.add(saved.code);
    } else {
      result.push({ ...def });
      processedCodes.add(def.code);
    }
  }

  // 2. Append any custom channels (e.g. MAXIM_FOOD, LALAMOVE, etc.)
  for (const saved of savedChannels) {
    if (!processedCodes.has(saved.code)) {
      result.push(saved);
      processedCodes.add(saved.code);
    }
  }

  return result;
}
