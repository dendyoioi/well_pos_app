export type CanonicalEventKey =
  | 'ORDER_CREATED'
  | 'ORDER_READY'
  | 'ORDER_OVERDUE'
  | 'PICKUP_REQUEST_CONFIRMED'
  | 'DELIVERY_FAILED'
  | 'CUSTOMER_DORMANT_WINBACK'
  | 'QUOTA_EXPIRING';

export type NotificationChannel = 'IN_APP' | 'WHATSAPP' | 'EMAIL';

export type PickupRequestStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'DRIVER_ASSIGNED'
  | 'PICKED_UP'
  | 'FAILED_ATTEMPT'
  | 'CANCELLED';

export interface PublicPortalOutletInfo {
  outlet: {
    id: string;
    name: string;
    address: string;
    phone: string;
    deliveryConfig?: {
      enabled: boolean;
      fixedFee: number;
      freeDeliveryThreshold?: number | null;
      maxCoverageKm?: number | null;
    } | null;
  };
  services: Array<{
    id: string;
    name: string;
    category: string;
    unit: string;
    durationHours: number;
    price: number;
    description?: string | null;
    minOrderQty?: number | null;
  }>;
}

export interface PublicPortalSessionResponse {
  isNewCustomer: boolean;
  token: string;
  customer?: {
    id: string;
    name: string;
    phone: string;
    address?: string | null;
    loyaltyPoints: number;
    tier: string;
    laundryPreferences?: any;
  } | null;
}

export interface LaundryPickupRequestRecord {
  id: string;
  tenantId: string;
  outletId: string;
  customerId?: string | null;
  requestCode: string;
  customerName: string;
  customerPhone: string;
  pickupAddress: string;
  pickupNotes?: string | null;
  preferredPickupAt?: string | null;
  estimatedWeightKg?: number | null;
  serviceCategory?: string | null;
  status: PickupRequestStatus;
  assignedDriverId?: string | null;
  courierName?: string | null;
  courierPhone?: string | null;
  routeOrder?: number | null;
  attemptCount: number;
  lastFailureReason?: string | null;
  rescheduledAt?: string | null;
  pickedUpAt?: string | null;
  convertedOrderId?: string | null;
  createdAt: string;
  updatedAt: string;
  customer?: {
    id: string;
    name: string;
    phone: string;
  } | null;
  assignedDriver?: {
    id: string;
    name: string;
    phone: string;
  } | null;
}

export interface PublicPortalMeResponse {
  customer: {
    id: string;
    name: string;
    phone?: string;
    email?: string | null;
    address?: string | null;
    loyaltyPoints: number;
    tier: string;
    laundryPreferences?: any;
  } | null;
  wallet: {
    balanceAmount: number;
    quotaKg: number;
    quotaExpiresAt?: string | null;
    balanceExpiresAt?: string | null;
  } | null;
  activeOrders: Array<{
    id: string;
    invoiceNumber: string;
    orderStatus: string;
    paymentStatus: string;
    totalAmount: number;
    createdAt: string;
    laundryDetail?: {
      currentStage: string;
      status: string;
      totalWeightKg?: number | null;
      totalPieces?: number | null;
      rackCode?: string | null;
      estimatedReadyAt?: string | null;
      deliveryType?: string | null;
      deliveryStatus?: string | null;
      qcStatus?: string | null;
    } | null;
    items?: Array<{
      productName: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }>;
  }>;
  recentOrders: Array<{
    id: string;
    invoiceNumber: string;
    orderStatus: string;
    paymentStatus: string;
    totalAmount: number;
    createdAt: string;
    laundryDetail?: {
      currentStage: string;
      status: string;
      totalWeightKg?: number | null;
      totalPieces?: number | null;
      rackCode?: string | null;
      estimatedReadyAt?: string | null;
      deliveryType?: string | null;
      deliveryStatus?: string | null;
      qcStatus?: string | null;
    } | null;
  }>;
  pickupRequests: LaundryPickupRequestRecord[];
}

export interface DriverBoardDeliveryTask {
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
    address?: string | null;
  } | null;
  laundryDetail?: {
    deliveryType: string;
    deliveryStatus: string;
    currentStage: string;
    rackCode?: string | null;
    deliveryAttemptCount?: number;
    deliveryLastFailureReason?: string | null;
    deliveryRescheduledAt?: string | null;
    deliveryRouteOrder?: number | null;
  } | null;
}

export interface DriverBoardResponse {
  pickupTasks: LaundryPickupRequestRecord[];
  deliveryTasks: DriverBoardDeliveryTask[];
  summary: {
    totalPendingPickups: number;
    totalAssignedPickups: number;
    totalActiveDeliveries: number;
    totalFailedAttempts: number;
  };
}

export interface NotificationAutomationRuleItem {
  eventKey: CanonicalEventKey;
  isEnabled: boolean;
  channels: NotificationChannel[];
  messageTemplate: string;
  isCustomized?: boolean;
}

export interface NotificationDispatchLogItem {
  id: string;
  tenantId: string;
  outletId?: string | null;
  eventKey: string;
  channel: string;
  recipientName?: string | null;
  recipientPhone?: string | null;
  recipientEmail?: string | null;
  referenceType?: string | null;
  referenceId?: string | null;
  messageBody: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED' | 'RETRIED';
  retryCount: number;
  errorMessage?: string | null;
  sentAt?: string | null;
  createdAt: string;
}

export interface NotificationLogsResponse {
  data: NotificationDispatchLogItem[];
  summary: {
    total: number;
    totalSent: number;
    totalFailed: number;
    totalSkipped: number;
  };
}
