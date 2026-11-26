/**
 * Type definitions for Laundry Core Engine Phase 4 — Enterprise Support
 * (Procurement 6-Stage, Workforce Enterprise, and Global Audit Trail)
 */

export interface PurchaseRequestItemRecord {
  id: string;
  tenantId: string;
  purchaseRequestId: string;
  inventoryItemId: string;
  quantityRequested: number | string;
  estimatedUnitCost: number | string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  inventoryItem?: {
    id: string;
    name: string;
    itemCode?: string;
    sku?: string;
    canonicalUom?: string;
    unit?: string;
    averageCost?: number | string;
    costPrice?: number | string;
  } | null;
}

export interface PurchaseRequestRecord {
  id: string;
  tenantId: string;
  outletId: string;
  storageLocationId?: string | null;
  prNumber: string;
  code?: string;
  requestedById?: string | null;
  requestedByName: string;
  status: 'PENDING' | 'SUBMITTED' | 'DRAFT' | 'APPROVED' | 'REJECTED' | 'CONVERTED_TO_PO';
  priority: 'NORMAL' | 'URGENT';
  neededByDate?: string | null;
  notes?: string | null;
  approvedById?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  convertedPoId?: string | null;
  createdAt: string;
  updatedAt: string;
  estimatedTotal?: number;
  items: PurchaseRequestItemRecord[];
  outlet?: { id: string; name: string; code?: string } | null;
  storageLocation?: { id: string; name: string } | null;
  convertedPo?: { id: string; poNumber: string; status: string; totalAmount: number | string } | null;
  requestedBy?: { id: string; name: string; email?: string | null; role?: string } | null;
  approvedBy?: { id: string; name: string; email?: string | null; role?: string } | null;
}

export interface PurchaseRequestSummary {
  submitted: number;
  approved: number;
  converted: number;
  rejected: number;
  total: number;
}

export interface SupplierInvoicePaymentRecord {
  id: string;
  tenantId: string;
  supplierInvoiceId: string;
  amount: number | string;
  paymentMethod: string;
  referenceNumber?: string | null;
  notes?: string | null;
  paidAt: string;
  paidById?: string | null;
  paidBy?: { id: string; name: string } | null;
}

export interface SupplierInvoiceRecord {
  id: string;
  tenantId: string;
  outletId: string;
  supplierId: string;
  purchaseOrderId?: string | null;
  invoiceNumber: string;
  supplierInvoiceRef?: string | null;
  invoiceDate: string;
  dueDate?: string | null;
  subtotal: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  paidAmount: number | string;
  remainingAmount: number | string;
  status: 'UNPAID' | 'PARTIAL' | 'PAID' | 'CANCELLED';
  notes?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  supplier?: { id: string; name: string; code?: string; phone?: string | null } | null;
  purchaseOrder?: { id: string; poNumber: string; status?: string; totalAmount?: number | string } | null;
  outlet?: { id: string; name: string } | null;
  payments?: SupplierInvoicePaymentRecord[];
}

export interface SupplierInvoiceSummary {
  totalInvoices: number;
  totalAmount: number;
  totalPaid: number;
  totalRemaining: number;
  overdueCount: number;
}

export interface StaffOvertimeRecord {
  id: string;
  tenantId: string;
  outletId: string;
  userId: string;
  workDate: string;
  hours: number | string;
  hourlyRate: number | string;
  totalPay: number | string;
  estimatedPay?: number;
  reason?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedById?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; userCode?: string; role?: string } | null;
  outlet?: { id: string; name: string } | null;
  approvedBy?: { id: string; name: string } | null;
}

export interface StaffLeaveRecord {
  id: string;
  tenantId: string;
  outletId: string;
  userId: string;
  leaveType: 'ANNUAL' | 'SICK' | 'UNPAID' | 'EMERGENCY' | string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedById?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; userCode?: string; role?: string } | null;
  outlet?: { id: string; name: string } | null;
  approvedBy?: { id: string; name: string } | null;
}

export interface StaffPayrollSlipRecord {
  id: string;
  tenantId: string;
  outletId: string;
  userId: string;
  periodYear: number;
  periodMonth: number;
  baseSalary: number | string;
  overtimePay: number | string;
  commissionPay: number | string;
  bonusAmount: number | string;
  cashAdvanceDeduction: number | string;
  otherDeduction: number | string;
  netSalary: number | string;
  status: 'DRAFT' | 'FINALIZED' | 'PAID';
  paidAt?: string | null;
  paymentMethod?: string | null;
  notes?: string | null;
  generatedById?: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; name: string; userCode?: string; role?: string; phone?: string | null } | null;
  outlet?: { id: string; name: string } | null;
  generatedBy?: { id: string; name: string } | null;
}

export interface PayrollSummary {
  totalSlips: number;
  totalGross: number;
  totalDeductions: number;
  totalNetSalary: number;
  totalPaidCount: number;
}

export interface GlobalAuditLogRecord {
  id: string;
  tenantId: string;
  outletId?: string | null;
  actorUserId?: string | null;
  actorName: string;
  actorRole: string;
  module: 'PROCUREMENT' | 'HR_PAYROLL' | 'ORDER' | 'PRICING' | 'FINANCE' | 'SECURITY' | 'SYSTEM' | string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  beforeData?: any;
  afterData?: any;
  ipAddress?: string | null;
  createdAt: string;
  outlet?: { id: string; name: string } | null;
  actorUser?: { id: string; name: string; role?: string } | null;
}
