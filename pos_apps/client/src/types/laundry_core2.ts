export type LaundryBatchStage = 'WASHING' | 'DRYING';
export type LaundryBatchStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type LaundryColorGroup = 'PUTIH' | 'WARNA' | 'GELAP' | 'CAMPUR' | 'DELICATE';

export interface LaundryBatchItemEntry {
  id: string;
  batchId: string;
  orderId: string;
  weightKg: number | string;
  order: {
    id: string;
    invoiceNumber: string;
    orderStatus: string;
    totalAmount: number;
    customer?: {
      id: string;
      name: string;
      phone?: string | null;
    } | null;
    laundryDetail?: {
      currentStage: string;
      estimatedReadyAt?: string | null;
      status: string;
      totalWeightKg?: number | string | null;
      totalPieces?: number;
      rackCode?: string | null;
    } | null;
  };
}

export interface LaundryBatchRecord {
  id: string;
  tenantId: string;
  outletId: string;
  batchCode: string;
  stage: LaundryBatchStage;
  machineId?: string | null;
  machineName?: string | null;
  colorGroup?: LaundryColorGroup | null;
  totalWeightKg: number | string;
  status: LaundryBatchStatus;
  operatorId?: string | null;
  operatorName?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  items: LaundryBatchItemEntry[];
  machine?: {
    id: string;
    code: string;
    name: string;
    machineType: string;
    capacityKg?: number | string | null;
    status: string;
  } | null;
  operator?: {
    id: string;
    name: string;
    email: string;
  } | null;
  outlet?: {
    id: string;
    name: string;
  } | null;
}

export type GarmentCategory = 'ATASAN' | 'BAWAHAN' | 'JAS_GAUN' | 'BEDDING' | 'SEPATU_TAS' | 'LAINNYA';
export type TrackedItemStage = 'TAGGED' | 'WASHING' | 'DRYING' | 'IRONING' | 'PACKED' | 'READY' | 'HANDED_OVER';

export interface LaundryTrackedItem {
  id: string;
  tenantId: string;
  outletId: string;
  orderId: string;
  tagCode: string;
  garmentName: string;
  category?: GarmentCategory | null;
  color?: string | null;
  brand?: string | null;
  specialTreatment?: string | null;
  currentStage: TrackedItemStage;
  rackCode?: string | null;
  photoUrl?: string | null;
  notes?: string | null;
  handedOverAt?: string | null;
  handedOverById?: string | null;
  handedOverByName?: string | null;
  receivedByName?: string | null;
  createdAt: string;
  updatedAt: string;
  order?: {
    id: string;
    invoiceNumber: string;
    orderStatus: string;
    customer?: {
      id: string;
      name: string;
      phone?: string | null;
    } | null;
    laundryDetail?: {
      currentStage: string;
      estimatedReadyAt?: string | null;
      status: string;
      rackCode?: string | null;
    } | null;
  } | null;
}

export interface LaundryOrderItemsResponse {
  orderId: string;
  totalItems: number;
  readyCount: number;
  handedOverCount: number;
  inProgressCount: number;
  items: LaundryTrackedItem[];
}

export interface PartialHandoverResponse {
  orderId: string;
  handedOverNow: number;
  totalHandedOver: number;
  totalItems: number;
  isFullyHandedOver: boolean;
}

export type QueuePriorityTier = 'CRITICAL' | 'URGENT' | 'HIGH' | 'NORMAL';

export interface SmartProductionQueueOrder {
  id: string;
  invoiceNumber: string;
  orderStatus: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
  customer?: {
    id: string;
    name: string;
    phone?: string | null;
  } | null;
  currentStage: string;
  status: string;
  totalWeightKg: number | null;
  totalPieces: number;
  rackCode: string | null;
  estimatedReadyAt: string | null;
  minutesLeft: number;
  isOverdue: boolean;
  isExpress: boolean;
  priorityTier: QueuePriorityTier;
  priorityScore: number;
  activeBatch?: {
    batchId: string;
    batchCode: string;
    stage: string;
    status: string;
    machineName?: string | null;
  } | null;
  trackedItemsSummary: {
    total: number;
    ready: number;
    handedOver: number;
    inProgress: number;
  };
}

export interface SmartProductionQueueSummary {
  totalActiveOrders: number;
  overdueCount: number;
  urgentCount: number;
  totalPendingWeightKg: number;
  activeBatchesCount: number;
}

export interface SmartProductionQueueResponse {
  status: 'success';
  data: SmartProductionQueueOrder[];
  summary: SmartProductionQueueSummary;
}
