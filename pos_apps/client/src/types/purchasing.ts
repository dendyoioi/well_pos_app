export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'ISSUED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  inventoryItemId: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  subtotal: number;
  inventoryItem?: {
    id: string;
    name: string;
    itemCode?: string;
    canonicalUom?: string;
  };
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  outletId: string;
  storageLocationId?: string | null;
  supplierId: string;
  status: PurchaseOrderStatus;
  orderDate: string;
  expectedDeliveryDate?: string | null;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  supplier?: {
    id: string;
    name: string;
    code: string;
    phone?: string | null;
    email?: string | null;
  };
  outlet?: {
    id: string;
    name: string;
    code?: string | null;
  };
  storageLocation?: {
    id: string;
    name: string;
  } | null;
  items?: PurchaseOrderItem[];
  _count?: {
    items: number;
  };
}

export interface CreatePurchaseOrderInput {
  outletId: string;
  supplierId: string;
  storageLocationId?: string;
  expectedDeliveryDate?: string;
  notes?: string;
  items: {
    inventoryItemId: string;
    quantityOrdered: number;
    unitCost: number;
    notes?: string;
  }[];
}

export interface ReceivePOItemInput {
  purchaseOrderItemId: string;
  quantityReceived: number;
  unitCost?: number;
  batchNumber?: string;
  expirationDate?: string;
}

export interface ReceivePOInput {
  items: ReceivePOItemInput[];
}

export type StockTransferStatus =
  | 'DRAFT'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'CANCELLED';

export interface StockTransferItem {
  id: string;
  stockTransferId: string;
  inventoryItemId: string;
  inventoryBatchId?: string | null;
  quantityDispatched: number;
  quantityReceived: number;
  unitCost: number;
  inventoryItem?: {
    id: string;
    name: string;
    itemCode?: string;
    canonicalUom?: string;
  };
  inventoryBatch?: {
    id: string;
    batchNumber: string;
    expirationDate?: string | null;
  } | null;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  sourceOutletId: string;
  sourceLocationId?: string | null;
  targetOutletId: string;
  targetLocationId?: string | null;
  status: StockTransferStatus;
  dispatchedAt?: string | null;
  receivedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  sourceOutlet?: {
    id: string;
    name: string;
    code?: string | null;
  };
  targetOutlet?: {
    id: string;
    name: string;
    code?: string | null;
  };
  items?: StockTransferItem[];
  _count?: {
    items: number;
  };
}

export interface CreateStockTransferInput {
  sourceOutletId: string;
  targetOutletId: string;
  sourceLocationId?: string;
  targetLocationId?: string;
  notes?: string;
  items: {
    inventoryItemId: string;
    quantityDispatched: number;
    unitCost?: number;
    inventoryBatchId?: string;
  }[];
}

export interface ExpiryAlertBatch {
  id: string;
  batchNumber: string;
  expirationDate: string;
  inventoryItemId: string;
  inventoryItem?: {
    id: string;
    name: string;
    canonicalUom: string;
    itemCode?: string;
  };
  balances?: Array<{
    quantityOnHand: number;
    storageLocation?: {
      name: string;
      outlet?: {
        id: string;
        name: string;
      };
    };
  }>;
}
