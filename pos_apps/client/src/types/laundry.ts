export type LaundryCategory = 'KILOAN' | 'SATUAN' | 'EXPRESS' | 'SEPATU_TAS' | string;

export type LaundryStatus =
  | 'RECEIVED'
  | 'WASHING_DRYING'
  | 'IRONING_PACKING'
  | 'READY_FOR_PICKUP'
  | 'COMPLETED';

export type LaundryTransferStatus =
  | 'AT_OUTLET'
  | 'IN_TRANSIT_TO_WORKSHOP'
  | 'AT_WORKSHOP'
  | 'IN_TRANSIT_TO_OUTLET';

export type LaundryProductionStageKey =
  | 'DROP_OFF'
  | 'TAGGING'
  | 'SORTING'
  | 'SPOTTING'
  | 'WASHING'
  | 'DRYING'
  | 'IRONING'
  | 'FOLDING'
  | 'PACKING'
  | 'RACK_STORAGE'
  | 'HANDOVER';

export interface LaundryStageInfo {
  key: LaundryProductionStageKey;
  sequence: number;
  label: string;
  shortLabel: string;
  macroStatus: LaundryStatus;
  description: string;
}

export const LAUNDRY_11_STAGES: LaundryStageInfo[] = [
  { key: 'DROP_OFF', sequence: 1, label: '1. Drop-off (Timbang)', shortLabel: 'Drop-off', macroStatus: 'RECEIVED', description: 'Penerimaan & timbangan awal kasir' },
  { key: 'TAGGING', sequence: 2, label: '2. Label / Tagging', shortLabel: 'Label', macroStatus: 'RECEIVED', description: 'Pemasangan pita/tag nomor nota anti-tertukar' },
  { key: 'SORTING', sequence: 3, label: '3. Sortir (Warna/Bahan)', shortLabel: 'Sortir', macroStatus: 'RECEIVED', description: 'Pemisahan pakaian putih vs warna & bahan tebal vs tipis' },
  { key: 'SPOTTING', sequence: 4, label: '4. Spotting (Noda)', shortLabel: 'Spotting', macroStatus: 'RECEIVED', description: 'Pre-treatment noda membandel (darah/minyak/karat/kerah)' },
  { key: 'WASHING', sequence: 5, label: '5. Cuci (Washing)', shortLabel: 'Cuci', macroStatus: 'WASHING_DRYING', description: 'Pencucian di mesin cuci dengan deterjen standar' },
  { key: 'DRYING', sequence: 6, label: '6. Kering (Drying)', shortLabel: 'Kering', macroStatus: 'WASHING_DRYING', description: 'Pengeringan dengan mesin dryer gas/listrik' },
  { key: 'IRONING', sequence: 7, label: '7. Setrika (Ironing)', shortLabel: 'Setrika', macroStatus: 'IRONING_PACKING', description: 'Penyetrikaan uap boiler hingga licin dan rapi' },
  { key: 'FOLDING', sequence: 8, label: '8. Lipat (Folding)', shortLabel: 'Lipat', macroStatus: 'IRONING_PACKING', description: 'Pelipatan pakaian dengan ukuran presisi seragam' },
  { key: 'PACKING', sequence: 9, label: '9. Packing & Parfum', shortLabel: 'Packing', macroStatus: 'IRONING_PACKING', description: 'Pemberian aroma parfum & pembungkusan plastik segel' },
  { key: 'RACK_STORAGE', sequence: 10, label: '10. Masuk Rak (Siap Ambil)', shortLabel: 'Di Rak', macroStatus: 'READY_FOR_PICKUP', description: 'Penempatan ke slot rak simpan & notifikasi WhatsApp pelanggan' },
  { key: 'HANDOVER', sequence: 11, label: '11. Penyerahan (Selesai)', shortLabel: 'Selesai', macroStatus: 'COMPLETED', description: 'Penyerahan pakaian bersih ke pelanggan & pelunasan kasir' },
];

export interface ProductionStageDefinition {
  id?: string;
  key: string;
  code?: string;
  name: string;
  sequence: number;
  isActive: boolean;
  isDefault?: boolean;
  macroStatus: LaundryStatus;
  description?: string;
  icon?: string;
}

export const DEFAULT_PRODUCTION_STAGES: ProductionStageDefinition[] = [
  { key: 'LABEL', code: '2000', name: 'Label & Tagging', sequence: 1, isActive: true, isDefault: true, macroStatus: 'RECEIVED', icon: 'Tag', description: 'Pemasangan tag label barcode pita anti-luntur pada pakaian' },
  { key: 'SORTIR', code: '3000', name: 'Sortir & QC Helai', sequence: 2, isActive: true, isDefault: true, macroStatus: 'RECEIVED', icon: 'Filter', description: 'Penghitungan jumlah helai, pemisahan warna/bahan, dan cek kendala fisik' },
  { key: 'CLEANING', code: '3100', name: 'Cleaning (Pembersihan Awal)', sequence: 3, isActive: true, isDefault: true, macroStatus: 'RECEIVED', icon: 'Sparkles', description: 'Pembersihan awal untuk kotoran berat, sepatu, tas, atau stroller' },
  { key: 'SPOTTING', code: '4000', name: 'Spotting (Treatment Noda)', sequence: 4, isActive: true, isDefault: true, macroStatus: 'RECEIVED', icon: 'ShieldAlert', description: 'Penanganan noda membandel (darah, tinta, karat, minyak) dengan bahan kimia khusus' },
  { key: 'DETAILING', code: '4100', name: 'Detailing & Proteksi', sequence: 5, isActive: true, isDefault: true, macroStatus: 'RECEIVED', icon: 'Wrench', description: 'Perawatan detail kancing, resleting, unyellowing sepatu, dan proteksi kain' },
  { key: 'CUCI', code: '5000', name: 'Cuci (Washing)', sequence: 6, isActive: true, isDefault: true, macroStatus: 'WASHING_DRYING', icon: 'Waves', description: 'Pencucian pakaian pada mesin washer / extractor sesuai takaran deterjen' },
  { key: 'KERING', code: '6000', name: 'Kering (Drying)', sequence: 7, isActive: true, isDefault: true, macroStatus: 'WASHING_DRYING', icon: 'Wind', description: 'Pengeringan pada mesin dryer tumbler dengan temperatur aman serat kain' },
  { key: 'SETRIKA', code: '7000', name: 'Setrika Uap (Ironing)', sequence: 8, isActive: true, isDefault: true, macroStatus: 'IRONING_PACKING', icon: 'Flame', description: 'Penyetrikaan uap boiler bertekanan tinggi hingga rapi dan licin' },
  { key: 'EXTRA_SETRIKA', code: '7100', name: 'Extra Setrika / Finishing', sequence: 9, isActive: true, isDefault: true, macroStatus: 'IRONING_PACKING', icon: 'Sparkles', description: 'Finishing khusus jas, gaun, kebaya, lipatan gorden, atau pewangi ekstra' },
  { key: 'LIPAT', code: '7200', name: 'Lipat (Folding)', sequence: 10, isActive: true, isDefault: true, macroStatus: 'IRONING_PACKING', icon: 'Layers', description: 'Pelipatan rapi sesuai standar dimensi kemasan' },
  { key: 'PENGEMASAN', code: '8000', name: 'Pengemasan & Rak (Packing)', sequence: 11, isActive: true, isDefault: true, macroStatus: 'READY_FOR_PICKUP', icon: 'Package', description: 'Penyemprotan parfum wangi, segel plastik higienis, dan simpan di rak' },
];

export interface LaundryService {
  id: string;
  tenantId?: string;
  name: string;
  category: LaundryCategory;
  unit: string;
  price: number;
  minOrderQty: number;
  durationHours: number;
  expressMultiplier: number;
  description?: string | null;
  stages?: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LaundryRack {
  id: string;
  tenantId?: string;
  outletId: string;
  code: string;
  name: string;
  category: LaundryCategory;
  capacity: number;
  currentCount?: number;
  locationNote?: string | null;
  isActive: boolean;
  activeOrders?: {
    orderId: string;
    orderNumber: string;
    customerName: string;
    customerPhone?: string | null;
    totalWeightKg?: number | null;
    totalPieces: number;
    paymentStatus: string;
    totalAmount?: number;
    paidAmount?: number;
    remainingAmount?: number;
    status: LaundryStatus;
    readyAt?: string | null;
    updatedAt?: string | Date;
    createdAt?: string | Date;
  }[];
}

export interface LaundryQueueOrder {
  id: string;
  orderId: string;
  invoiceNumber: string;
  status: LaundryStatus;
  customerName: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  deliveryType?: 'SELF_PICKUP' | 'DELIVERY' | LaundryDeliveryType | string;
  deliveryDistanceKm?: number;
  deliveryFee?: number;
  serviceName: string;
  totalWeightKg?: number | null;
  totalPieces: number;
  grandTotal: number;
  paidAmount: number;
  paymentStatus: string;
  rackCode?: string | null;
  perfumeVariant: string;
  currentStage?: LaundryProductionStageKey;
  transferStatus?: LaundryTransferStatus;
  workshopOutletId?: string | null;
  customerNotes?: string | null;
  isSorted?: boolean;
  garmentCounts?: Array<{ type: string; qty: number }>;
  defects?: string[];
  defectNotes?: string | null;
  conditionPhotos?: Array<{
    url: string;
    caption?: string;
    stage?: string;
    uploadedBy?: string;
    uploadedAt?: string;
  }>;
  sortedAt?: string | null;
  sortedBy?: string | null;
  estimatedReadyAt?: string | null;
  completedAt?: string | null;
  pickedUpAt?: string | null;
  createdAt: string;
  items?: Array<{
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    subtotal: number;
    notes?: string;
    addons?: Array<{ id: string; name: string; price: number; unit: string; total: number }>;
  }>;
}

export interface LaundryTransferManifest {
  id: string;
  manifestNumber: string;
  sourceOutletId: string;
  targetOutletId: string;
  status: 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';
  direction: 'TO_WORKSHOP' | 'TO_OUTLET';
  driverName?: string | null;
  vehiclePlate?: string | null;
  totalOrdersCount: number;
  totalOrders?: number;
  totalPieces?: number;
  totalWeightKg?: number | null;
  notes?: string | null;
  dispatchedAt: string;
  receivedAt?: string | null;
  receivedBy?: string | null;
  createdAt: string;
  sourceOutlet?: { id: string; name: string; address?: string | null; phone?: string | null };
  targetOutlet?: { id: string; name: string; address?: string | null; phone?: string | null; isWorkshop?: boolean };
  items?: {
    id: string;
    manifestId: string;
    orderId: string;
    order?: {
      id: string;
      invoiceNumber: string;
      customer?: { name: string; phone?: string | null };
      items?: Array<{ productName: string; quantity: number }>;
      laundryDetail?: {
        totalWeightKg?: number | null;
        totalPieces: number;
        status: LaundryStatus;
        perfumeVariant?: string | null;
      };
    };
  }[];
}

export interface AvailableOrderForManifest {
  id: string;
  orderId: string;
  invoiceNumber: string;
  customerName: string;
  serviceName: string;
  totalWeightKg?: number | null;
  totalPieces: number;
  status: LaundryStatus;
  perfumeVariant?: string | null;
  outletName?: string;
  createdAt: string;
}

export interface CreateLaundryOrderPayload {
  outletId: string;
  customerId?: string | null;
  customerName: string;
  customerPhone?: string | null;
  items: {
    serviceId?: string;
    name: string;
    category: LaundryCategory;
    quantity: number;
    unit: string;
    unitPrice: number;
    notes?: string;
  }[];
  totalPieces: number;
  perfumeVariant: string;
  estimatedReadyHours: number;
  depositAmount: number;
  paymentMethod: 'CASH' | 'QRIS' | 'TRANSFER' | 'UNPAID';
  customerNotes?: string;
}

export interface LaundryStageLog {
  id: string;
  orderId: string;
  laundryDetailId: string;
  stage: LaundryProductionStageKey;
  operatorId?: string | null;
  operatorName?: string | null;
  weightKg?: number | null;
  piecesCount?: number;
  startedAt?: string;
  completedAt?: string | null;
  durationMinutes?: number | null;
  notes?: string | null;
  createdAt: string;
}

export interface LaundryOperatorKpi {
  operatorId: string;
  operatorName: string;
  totalJobs: number;
  totalWashingKg: number;
  totalDryingKg: number;
  totalIroningKg: number;
  totalPackingOrders: number;
  totalDurationMinutes: number;
  stagesCount: Record<string, number>;
}

export interface CustomerLaundryWalletLedger {
  id: string;
  walletId: string;
  tenantId: string;
  outletId: string;
  orderId?: string | null;
  shiftId?: string | null;
  cashierId?: string | null;
  ledgerType: string;
  deltaAmount: number;
  balanceBefore: number;
  balanceAfter: number;
  deltaKg: number;
  kgBefore: number;
  kgAfter: number;
  paymentMethod?: string | null;
  notes?: string | null;
  createdAt: string;
  cashierName?: string;
  outletName?: string;
  invoiceNumber?: string;
}

export interface CustomerLaundryWallet {
  id?: string;
  balanceAmount: number;
  quotaKg: number;
  quotaExpiresAt?: string | null;
  ledgers?: CustomerLaundryWalletLedger[];
}

export type LaundryDeliveryType =
  | 'NONE'
  | 'PICKUP_ONLY'
  | 'DELIVERY_ONLY'
  | 'PICKUP_AND_DELIVERY'
  | 'SELF_PICKUP'
  | 'DELIVERY';

export type LaundryDeliveryStatus =
  | 'PENDING_PICKUP'
  | 'PICKED_UP'
  | 'READY_TO_DELIVER'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED';

export interface LaundryDeliveryZone {
  id: string;
  name: string;
  fee: number;
  minOrderAmount?: number;
  isActive?: boolean;
  estimatedDeliveryTime?: string;
}

export interface LaundryDeliveryConfig {
  enabled: boolean;
  freeDeliveryMinAmount: number;
  freeDeliveryMinWeightKg: number;
  roundTripMultiplier: number;
  zones: LaundryDeliveryZone[];
}

export interface LaundryDeliveryTask {
  id: string;
  orderId: string;
  invoiceNumber: string;
  status: LaundryStatus;
  currentStage: string;
  rackCode?: string | null;
  serviceName?: string;
  totalWeightKg?: number | null;
  totalPieces: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: string;
  customer?: {
    id: string;
    name: string;
    phone?: string | null;
    address?: string | null;
  } | null;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
  deliveryType: string;
  deliveryStatus: LaundryDeliveryStatus;
  deliveryFee: number;
  deliveryZoneName?: string | null;
  deliveryAddress?: string | null;
  deliveryNotes?: string | null;
  deliveryScheduledAt?: string | null;
  courierName?: string | null;
  courierPhone?: string | null;
  deliveredAt?: string | null;
  deliveryProofPhotoUrl?: string | null;
  createdAt: string;
  order: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    paidAmount: number;
    paymentStatus: string;
    paymentMethod?: string;
    status?: string;
    currentStage?: string;
    customer?: {
      id: string;
      name: string;
      phone?: string | null;
      address?: string | null;
    } | null;
    serviceName?: string;
    rackCode?: string | null;
    totalWeightKg?: number | null;
    totalPieces?: number;
  };
}

export interface LaundryDeliveryKpi {
  pendingPickup: number;
  readyToDeliver: number;
  outForDelivery: number;
  deliveredToday: number;
  totalCodRemaining: number;
}
