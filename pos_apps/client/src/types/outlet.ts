export type FeeType = 'PERCENTAGE' | 'FIXED';

export type FeeChannelScope =
  | 'ALL'
  | 'DINE_IN'
  | 'TAKEAWAY'
  | 'GOFOOD'
  | 'GRABFOOD'
  | 'SHOPEEFOOD'
  | 'DELIVERY';

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

export interface ReceiptConfig {
  paperSize: '58mm' | '80mm';
  footerText?: string;
}

export interface Outlet {
  id: string;
  tenantId?: string | null;
  name: string;
  address?: string | null;
  phone?: string | null;
  isWarehouse?: boolean;
  warehouseId?: string | null;
  warehouse?: Outlet | null;
  feesConfig?: OutletFee[] | null;
  receiptConfig?: ReceiptConfig | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
  _count?: {
    users?: number;
    orders?: number;
    outletProducts?: number;
  };
}
