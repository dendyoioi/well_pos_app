export interface CustomerLaundryPreferences {
  allergies?: string[];
  separateColors?: boolean;
  preferFoldOrHang?: 'FOLD' | 'HANG' | 'MIXED';
  preferPerfume?: string | null;
  avoidSoftener?: boolean;
  alwaysExpress?: boolean;
  customNotes?: string | null;
}

export interface CustomerPreferencesResponse {
  customerId: string;
  name: string;
  phone?: string | null;
  secondaryPhones: string[];
  laundryPreferences: CustomerLaundryPreferences;
}

export interface QcChecklistData {
  stainFree: boolean;
  odorFresh: boolean;
  ironedNeat: boolean;
  pieceCountVerified: boolean;
  verifiedPieces?: number;
  notes?: string;
}

export interface OrderWeightUpdateResponse {
  orderId: string;
  initialWeightKg: number;
  finalWeightKg: number;
  weightDiffKg: number;
  weightDiffReason?: string | null;
  totalWeightKg: number;
}

export interface OrderQcUpdateResponse {
  orderId: string;
  qcStatus: 'PASSED' | 'REWASH_REQUIRED';
  qcChecklist: QcChecklistData;
  qcCheckedAt: string;
  qcCheckedByName?: string | null;
  currentStage: string;
  status: string;
}

export type LostAndFoundCategory =
  | 'POCKET_ITEM'
  | 'UNCLAIMED_GARMENT'
  | 'ACCESSORIES'
  | 'DOCUMENTS'
  | (string & {});
export type LostAndFoundStatus = 'FOUND' | 'NOTIFIED' | 'RETURNED' | 'DISPOSED';

export interface LaundryLostAndFoundItem {
  id: string;
  tenantId: string;
  outletId: string;
  orderId?: string | null;
  customerId?: string | null;
  itemCategory: LostAndFoundCategory;
  itemName: string;
  description?: string | null;
  photoUrl?: string | null;
  storageLocation?: string | null;
  status: LostAndFoundStatus;
  foundById?: string | null;
  foundByName?: string | null;
  claimedByName?: string | null;
  returnedById?: string | null;
  returnedAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  order?: { id: string; invoiceNumber: string } | null;
  customer?: { id: string; name: string; phone?: string | null } | null;
  outlet?: { id: string; name: string; code?: string | null } | null;
  foundBy?: { id: string; name: string } | null;
  returnedBy?: { id: string; name: string } | null;
}

export interface OutletServicePricingItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  durationHours: number;
  minOrderQty: number;
  basePrice: number;
  priceOverride: number | null;
  effectivePrice: number;
  baseExpressMultiplier: number;
  expressMultiplierOverride: number | null;
  effectiveExpressMultiplier: number;
  isMasterActive: boolean;
  isAvailable: boolean;
}

export interface LaundryServicePriceHistoryItem {
  id: string;
  serviceId: string;
  outletId?: string | null;
  outletName: string;
  oldPrice: number;
  newPrice: number;
  reason?: string | null;
  changedById?: string | null;
  changedByName?: string | null;
  createdAt: string;
}
