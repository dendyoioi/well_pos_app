export interface PromotionItemTarget {
  id?: string;
  productId: string;
  variantId?: string | null;
  discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue?: number;
  product?: {
    id: string;
    name: string;
    sku?: string | null;
    imageUrl?: string | null;
  };
  variant?: {
    id: string;
    name: string;
    price: number | string;
    sku?: string | null;
  } | null;
}

export interface ActiveItemDiscount {
  promotionId: string;
  promotionName: string;
  promotionCode: string;
  productId: string;
  productName?: string;
  variantId?: string | null;
  variantName?: string | null;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  startDate: string;
  endDate: string;
}

export interface Promotion {
  id: string;
  tenantId?: string;
  code: string;
  name: string;
  description?: string | null;
  scope?: 'ORDER' | 'ITEM';
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number | null;
  usageLimit?: number | null;
  usedCount: number;
  perCustomerLimit: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items?: PromotionItemTarget[];
  _count?: {
    usages?: number;
    items?: number;
  };
}

export interface PromotionFormData {
  code: string;
  name: string;
  description?: string;
  scope?: 'ORDER' | 'ITEM';
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number | null;
  usageLimit?: number | null;
  perCustomerLimit?: number;
  startDate: string;
  endDate: string;
  isActive?: boolean;
  items?: PromotionItemTarget[];
}
