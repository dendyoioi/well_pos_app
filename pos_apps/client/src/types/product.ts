export interface Category {
  id: string;
  name: string;
  productCount?: number;
  createdAt?: string;
}

export interface ProductModifierOption {
  id: string;
  name: string;
  priceDelta: number; // 0 jika gratis, atau misal 3000 jika tambah topping
  isDefault?: boolean;
}

export interface ProductModifierGroup {
  id: string;
  name: string; // misal: "Level Pedas", "Level Gula", "Level Es", "Topping"
  type: 'SINGLE' | 'MULTIPLE'; // Radio vs Checkbox
  required: boolean;
  options: ProductModifierOption[];
}

export interface Product {
  id: string;
  barcode: string;
  sku: string;
  name: string;
  description?: string | null;
  costPrice: number;
  basePrice: number;
  price?: number;
  unit: string;
  imageUrl?: string | null;
  isActive: boolean;
  category: {
    id: string;
    name: string;
  };
  stock: number;
  warehouseStock?: number | null;
  minStockAlert: number;
  isLowStock?: boolean;
  modifiers?: ProductModifierGroup[];
  createdAt?: string;
}

export type StockMovementType =
  | 'PURCHASE_IN'
  | 'SALE_OUT'
  | 'DAMAGE_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ADJUSTMENT';

export interface StockMovement {
  id: string;
  outletId: string;
  productId: string;
  userId: string;
  type: StockMovementType;
  quantity: number;
  notes?: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  };
  user: {
    id: string;
    name: string;
    role: string;
  };
  outlet?: {
    id: string;
    name: string;
  };
}

export interface LowStockProduct {
  productId: string;
  name: string;
  sku: string;
  barcode: string;
  unit: string;
  stock: number;
  minStockAlert: number;
}
