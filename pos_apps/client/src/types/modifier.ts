export interface ModifierRecipeEffect {
  id?: string;
  inventoryItemId: string;
  quantityDelta: number;
  inventoryItem?: {
    id: string;
    name: string;
    canonicalUom: string;
  };
}

export interface ModifierItem {
  id?: string;
  name: string;
  priceAdjustment: number;
  isDefault: boolean;
  recipeEffects?: ModifierRecipeEffect[];
  inventoryEffect?: {
    inventoryItemId: string;
    quantityDelta: number;
  };
}

export interface ModifierGroup {
  id: string;
  name: string;
  selectionType: 'SINGLE' | 'MULTIPLE';
  minSelection: number;
  maxSelection: number;
  isRequired: boolean;
  items: ModifierItem[];
  products?: {
    id: string;
    productId: string;
    product: {
      id: string;
      name: string;
    };
  }[];
  createdAt?: string;
  updatedAt?: string;
}

export interface UpsertModifierGroupInput {
  id?: string;
  name: string;
  selectionType: 'SINGLE' | 'MULTIPLE';
  minSelection: number;
  maxSelection: number;
  isRequired: boolean;
  items: {
    id?: string;
    name: string;
    priceAdjustment: number;
    isDefault: boolean;
    inventoryEffect?: {
      inventoryItemId: string;
      quantityDelta: number;
    };
  }[];
}
