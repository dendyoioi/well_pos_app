export interface Category {
  id: string;
  name: string;
  slug?: string;
  productCount?: number;
  _count?: {
    products: number;
  };
  createdAt?: string;
}

export interface ProductVariant {
  id: string;
  sku?: string;
  barcode?: string;
  name: string;
  price: number;
  costPrice?: number;
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
  productType?: string;
  hasStock?: boolean;
  hasRecipe?: boolean;
  recipeId?: string | null;
  modifiers?: ProductModifierGroup[];
  variants?: ProductVariant[];
  createdAt?: string;
}

export type StockMovementType =
  | 'PURCHASE_IN'
  | 'SALE_OUT'
  | 'DAMAGE_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ADJUSTMENT'
  | 'SALE'
  | 'PURCHASE'
  | 'OPNAME_ADJUSTMENT'
  | 'RETURN'
  | 'WASTE'
  | 'VOID'
  | 'PRODUCTION_CONSUMPTION'
  | 'PRODUCTION_OUTPUT'
  | string;

export interface StockMovement {
  id: string;
  outletId: string;
  productId: string;
  userId?: string | null;
  type: StockMovementType;
  quantity: number;
  stockBefore?: number;
  stockAfter?: number;
  notes?: string | null;
  createdAt: string;
  product?: {
    id: string;
    name: string;
    sku: string;
    unit: string;
  } | null;
  user?: {
    id: string;
    name: string;
    role: string;
  } | null;
  outlet?: {
    id: string;
    name: string;
  } | null;
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
