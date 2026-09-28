import { PrismaClient } from '@prisma/client';

/**
 * Dual-Write Context passed to all dual-write domain service operations.
 * Encapsulates the active Prisma transaction client and multi-tenant scoping.
 */
export interface DualWriteContext {
  tx: any; // Prisma transactional client ($transaction tx)
  tenantId: string;
  actorUserId?: string | null;
  strictAtomic?: boolean; // Defaults to true (Pola A). If false, triggers emergency drift logger on target failure.
}

/**
 * Standardized return wrapper for dual-write operations.
 */
export interface DualWriteResult<T> {
  legacyData: T;
  targetSynced: boolean;
  targetRecordsAffected: number;
  targetDetails?: Record<string, any>;
}

/**
 * Emergency Drift Queue / Audit Entry structure (OD-14.1-01)
 */
export interface EmergencyDriftEntry {
  domain: string;
  operation: string;
  tenantId: string;
  entityId?: string;
  payload: any;
  errorMessage: string;
  errorStack?: string;
  occurredAt: Date;
}

// ==========================================
// CATALOG DOMAIN DTOs
// ==========================================

export interface CreateProductDTO {
  barcode?: string | null;
  sku?: string | null;
  name: string;
  categoryId: string;
  costPrice: number;
  basePrice: number;
  unit: string;
  description?: string | null;
  imageUrl?: string | null;
  initialStock: number;
  minStockAlert?: number;
  outletId: string;
}

export interface UpdateProductDTO {
  name?: string;
  barcode?: string | null;
  sku?: string | null;
  categoryId?: string;
  costPrice?: number;
  basePrice?: number;
  unit?: string;
  description?: string | null;
  imageUrl?: string | null;
  minStockAlert?: number;
  isActive?: boolean;
}

// ==========================================
// INVENTORY DOMAIN DTOs
// ==========================================

export interface StockInDTO {
  outletId: string;
  productId: string;
  quantity: number;
  notes?: string | null;
  poNumber?: string | null;
  supplierName?: string | null;
  newCostPrice?: number | null;
}

export interface StockOutDTO {
  outletId: string;
  productId: string;
  quantity: number;
  notes?: string | null;
  reason?: string | null;
}

export interface StockAdjustmentDTO {
  outletId: string;
  productId: string;
  actualStock: number;
  notes?: string | null;
}

export interface StockTransferDTO {
  sourceOutletId: string;
  targetOutletId: string;
  productId?: string;
  inventoryItemId?: string;
  quantity: number;
  notes?: string | null;
}

// ==========================================
// SALES DOMAIN DTOs
// ==========================================

export interface CheckoutItemDTO {
  productId: string;
  variantId?: string | null;
  modifierItemIds?: string[];
  modifiersSnapshot?: any;
  quantity: number;
  costPrice: number;
  unitPrice: number;
  discountAmount?: number;
  subtotal: number;
  notes?: string | null;
}

export interface CheckoutPaymentDTO {
  method: string; // CASH, QRIS, DEBIT, CREDIT, TRANSFER
  amountPaid: number;
  changeGiven?: number;
  qrisReference?: string | null;
  status?: string;
}

export interface CheckoutOrderDTO {
  targetOutletId: string;
  cashierId: string;
  invoiceNumber?: string;
  channel?: string;
  orderType?: string | null;
  tableNumber?: string | null;
  notes?: string | null;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  existingOrderId?: string | null;
  shiftId?: string | null;
  items: CheckoutItemDTO[];
  payments: CheckoutPaymentDTO[];
  subtotal: number;
  globalDiscount?: number;
  taxAmount?: number;
  serviceCharge?: number;
  grandTotal: number;
  totalCost: number;
}

// ==========================================
// USER IAM DOMAIN DTOs (MODEL B)
// ==========================================

export interface CreateUserDTO {
  name: string;
  email: string;
  passwordHash: string;
  userCode?: string | null;
  pin?: string | null;
  role: string;
  outletId?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  canCashOut?: boolean;
  isActive?: boolean;
}

export interface UpdateUserDTO {
  name?: string;
  email?: string;
  passwordHash?: string;
  userCode?: string | null;
  pin?: string | null;
  role?: string;
  outletId?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  canCashOut?: boolean;
  isActive?: boolean;
}

// ==========================================
// LOCATION DOMAIN DTOs
// ==========================================

export interface CreateOutletDTO {
  name: string;
  address?: string | null;
  phone?: string | null;
  isWarehouse?: boolean;
  feesConfig?: any;
}
