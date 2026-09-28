export interface RecipeInventoryItem {
  id: string;
  itemCode?: string;
  name: string;
  canonicalUom: string;
  averageCost?: number;
  stock?: number;
  warehouseStock?: number;
  warehouseId?: string | null;
  warehouseName?: string | null;
  supplySource?: 'WAREHOUSE' | 'OUTLET_LOCAL';
  reorderPoint?: number;
}

export interface RecipeItem {
  id?: string;
  inventoryItemId: string;
  quantity: number;
  costRatio?: number;
  inventoryItem?: RecipeInventoryItem;
}

export interface RecipeProductVariant {
  id: string;
  name: string;
  sku?: string;
  price: number;
  product?: {
    id: string;
    name: string;
    category?: {
      id: string;
      name: string;
    };
  };
}

export interface Recipe {
  id: string;
  productVariantId: string;
  instructions?: string | null;
  yieldQuantity: number;
  productVariant?: RecipeProductVariant;
  items: RecipeItem[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UpsertRecipeInput {
  productVariantId: string;
  instructions?: string | null;
  yieldQuantity?: number;
  items: {
    inventoryItemId: string;
    quantity: number;
    costRatio?: number;
  }[];
}
