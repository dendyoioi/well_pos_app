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

export const DEFAULT_LAUNDRY_OUTLET_FEES: OutletFee[] = [
  {
    id: 'fee_tax',
    name: 'PPN Layanan Laundry',
    type: 'PERCENTAGE',
    rate: 11,
    channelScope: 'ALL',
    isActive: false,
    category: 'DEFAULT_TAX_SERVICE',
  },
  {
    id: 'fee_delivery',
    name: 'Ongkir Kurir Laundry',
    type: 'FIXED',
    rate: 10000,
    channelScope: 'DELIVERY',
    isActive: false,
    category: 'DEFAULT_TAX_SERVICE',
  },
  {
    id: 'fee_plastic_s',
    name: 'Plastik / Kresek Laundry',
    type: 'FIXED',
    rate: 500,
    channelScope: 'ALL',
    isActive: false,
    category: 'ON_DEMAND_PACKAGING',
    isQuickAccess: false,
  },
  {
    id: 'fee_hanger',
    name: 'Hanger Baju / Jas',
    type: 'FIXED',
    rate: 2000,
    channelScope: 'ALL',
    isActive: false,
    category: 'ON_DEMAND_PACKAGING',
    isQuickAccess: false,
  },
  {
    id: 'fee_cover_jas',
    name: 'Cover Plastik Jas / Gaun',
    type: 'FIXED',
    rate: 3000,
    channelScope: 'ALL',
    isActive: false,
    category: 'ON_DEMAND_PACKAGING',
    isQuickAccess: false,
  },
  {
    id: 'fee_spunbond',
    name: 'Tas Laundry Spunbond',
    type: 'FIXED',
    rate: 5000,
    channelScope: 'ALL',
    isActive: false,
    category: 'ON_DEMAND_PACKAGING',
    isQuickAccess: false,
  },
];

const FNB_RESIDUE_IDS = new Set(['fee_service', 'fee_online', 'fee_cutlery', 'fee_box', 'fee_paperbag']);
const FNB_RESIDUE_NAMES = new Set([
  'Biaya Layanan Meja',
  'Biaya Platform Online',
  'Set Sendok & Garpu Higienis',
  'Box Kemasan / Mika',
  'Paper Bag Kraft',
]);

export function normalizeOutletFees(
  savedFees?: OutletFee[] | null,
  isLaundryMode?: boolean
): OutletFee[] {
  if (!savedFees || !Array.isArray(savedFees) || savedFees.length === 0) {
    return isLaundryMode ? DEFAULT_LAUNDRY_OUTLET_FEES : DEFAULT_OUTLET_FEES;
  }

  const result: OutletFee[] = [];
  let hadInactiveFnbResidue = false;

  for (const saved of savedFees) {
    if (isLaundryMode && !saved.isActive) {
      if (FNB_RESIDUE_IDS.has(saved.id) || FNB_RESIDUE_NAMES.has(saved.name)) {
        hadInactiveFnbResidue = true;
        continue;
      }
    }

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

    let normalizedName = saved.name;
    let normalizedRate = saved.rate;
    if (isLaundryMode && !saved.isActive) {
      if (saved.id === 'fee_tax' && saved.name === 'PPN / PB1 Pajak Restoran') {
        normalizedName = 'PPN Layanan Laundry';
        if (saved.rate === 10) normalizedRate = 11;
      } else if (saved.id === 'fee_delivery' && saved.name === 'Ongkir Kurir Toko') {
        normalizedName = 'Ongkir Kurir Laundry';
      } else if (saved.id === 'fee_plastic_s' && saved.name === 'Plastik / Kresek Sedang') {
        normalizedName = 'Plastik / Kresek Laundry';
      }
    }

    result.push({
      ...saved,
      name: normalizedName,
      rate: normalizedRate,
      category,
      isQuickAccess: saved.isQuickAccess ?? (category === 'ON_DEMAND_PACKAGING'),
    });
  }

  if (isLaundryMode && (hadInactiveFnbResidue || !result.some((f) => f.category === 'ON_DEMAND_PACKAGING'))) {
    const existingIds = new Set(result.map((f) => f.id));
    for (const defLaundry of DEFAULT_LAUNDRY_OUTLET_FEES) {
      if (defLaundry.category === 'ON_DEMAND_PACKAGING' && !existingIds.has(defLaundry.id)) {
        result.push(defLaundry);
      }
    }
  }

  return result;
}

export interface WhatsAppConfig {
  enabled?: boolean;
  provider?: 'FONNTE';
  autoSendOnCheckout?: boolean;
  autoSendWaOnDropoff?: boolean;
  usePlatformGateway?: boolean;
  usePlatformFallback?: boolean;
  apiKey?: string;
  senderNumber?: string;
  customFooter?: string;
}

export interface CupLabelConfig {
  enabled: boolean;
  paperSize: '40x30mm' | '50x30mm' | '40x20mm' | '50x40mm';
  autoPrintOnCheckout?: boolean;
  onlyBeverages?: boolean;
  showStoreName?: boolean;
  showCustomerName?: boolean;
  showOrderNumber?: boolean;
  showModifiers?: boolean;
  showPrice?: boolean;
  customHeader?: string;
}

export interface ReceiptConfig {
  paperSize: '58mm' | '80mm';
  footerText?: string;
  showQueueNumber?: boolean;
  showWatermark?: boolean; // Default true: Tampilkan watermark "Powered by Well POS"
  whatsappConfig?: WhatsAppConfig;
  cupLabelConfig?: CupLabelConfig;
  laundryTerms?: string;
  autoSendWaOnDropoff?: boolean;
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

export interface CustomerDebtConfig {
  allowCredit: boolean;
  defaultDueDays?: number;
}

export interface PaymentConfig {
  qris?: QrisConfig | null;
  customerDebt?: CustomerDebtConfig | null;
}

export interface OutletLoyaltyConfig {
  isActive: boolean;
  pointsPerSpend?: number; // default: 10000 (Rp 10.000 = 1 Poin)
  pointValueIdr?: number; // default: 100 (1 Poin = Rp 100)
  minPointsToRedeem?: number; // default: 10 (minimal tukar 10 poin)
}

export interface Outlet {
  id: string;
  tenantId?: string | null;
  name: string;
  merchantName?: string | null;
  address?: string | null;
  phone?: string | null;
  isWarehouse?: boolean;
  isWorkshop?: boolean;
  googleReviewUrl?: string | null;
  warehouseId?: string | null;
  warehouse?: Outlet | null;
  feesConfig?: OutletFee[] | null;
  receiptConfig?: ReceiptConfig | null;
  channelsConfig?: SalesChannelConfig[] | null;
  paymentConfig?: PaymentConfig | null;
  loyaltyConfig?: OutletLoyaltyConfig | null;
  timezone?: string | null;
  attendanceConfig?: any;
  industries?: string[] | null;
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
