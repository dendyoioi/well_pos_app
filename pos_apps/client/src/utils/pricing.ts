import type { CartItem } from '../types/order';

export interface EffectivePricingResult {
  price: number;
  basePrice: number;
  isTierApplied: boolean;
  minQuantity?: number;
  tierSavingsPerUnit: number;
}

/**
 * Menghitung harga efektif item keranjang kasir dengan mendeteksi
 * struktur Harga Grosir Bertingkat (Product Price Tiers).
 */
export function getEffectiveItemPricing(item: CartItem): EffectivePricingResult {
  const originalBasePrice = item.product?.price || item.product?.basePrice || 0;

  if (item.customPrice !== undefined && item.customPrice !== null) {
    return {
      price: item.customPrice,
      basePrice: originalBasePrice,
      isTierApplied: false,
      tierSavingsPerUnit: 0,
    };
  }

  // Cek apakah item memiliki struktur harga grosir aktif
  if (item.product?.priceTiers && item.product.priceTiers.length > 0) {
    const applicableTiers = [...item.product.priceTiers]
      .filter((t) => item.quantity >= t.minQuantity)
      .sort((a, b) => b.minQuantity - a.minQuantity);

    if (applicableTiers.length > 0) {
      const bestTier = applicableTiers[0];
      const tierPrice = Number(bestTier.tierPrice);
      return {
        price: tierPrice,
        basePrice: originalBasePrice,
        isTierApplied: true,
        minQuantity: bestTier.minQuantity,
        tierSavingsPerUnit: Math.max(0, originalBasePrice - tierPrice),
      };
    }
  }

  return {
    price: originalBasePrice,
    basePrice: originalBasePrice,
    isTierApplied: false,
    tierSavingsPerUnit: 0,
  };
}

/**
 * Menghitung subtotal bersih baris item keranjang setelah diskon item
 */
export function getCartItemSubtotal(item: CartItem): number {
  const pricing = getEffectiveItemPricing(item);
  const netPrice = Math.max(0, pricing.price - (item.discountAmount || 0));
  return netPrice * item.quantity;
}

