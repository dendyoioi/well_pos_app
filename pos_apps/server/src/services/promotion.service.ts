import { PrismaClient, DiscountType } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface ValidatePromotionResult {
  valid: boolean;
  message?: string;
  promotion?: any;
  discountAmount: number;
}

export class PromotionService {
  /**
   * Validate a promotional code against an order subtotal and optional customer
   */
  async validatePromotion(
    tenantId: string,
    code: string,
    subtotal: number,
    customerId?: string | null
  ): Promise<ValidatePromotionResult> {
    const cleanCode = code.trim().toUpperCase();

    const promotion = await prisma.promotion.findFirst({
      where: {
        tenantId,
        code: cleanCode,
      },
    });

    if (!promotion) {
      return { valid: false, message: `Kode promo "${cleanCode}" tidak ditemukan`, discountAmount: 0 };
    }

    if (!promotion.isActive) {
      return { valid: false, message: `Promo "${promotion.name}" sedang tidak aktif`, discountAmount: 0 };
    }

    const now = new Date();
    if (promotion.startDate > now) {
      return { valid: false, message: `Promo "${promotion.name}" belum dimulai`, discountAmount: 0 };
    }
    if (promotion.endDate < now) {
      return { valid: false, message: `Promo "${promotion.name}" sudah berakhir`, discountAmount: 0 };
    }

    const minSpend = Number(promotion.minOrderAmount || 0);
    if (subtotal < minSpend) {
      return {
        valid: false,
        message: `Minimal belanja untuk promo ini adalah Rp ${minSpend.toLocaleString('id-ID')}`,
        discountAmount: 0,
      };
    }

    // Check global usage limit
    if (promotion.usageLimit !== null && promotion.usageLimit !== undefined) {
      if (promotion.usageCount >= promotion.usageLimit) {
        return { valid: false, message: 'Kuota promo sudah habis', discountAmount: 0 };
      }
    }

    // Check per-customer limit
    if (customerId && promotion.perCustomerLimit > 0) {
      const customerUsageCount = await prisma.promotionUsage.count({
        where: {
          tenantId,
          promotionId: promotion.id,
          customerId,
        },
      });

      if (customerUsageCount >= promotion.perCustomerLimit) {
        return {
          valid: false,
          message: `Anda sudah mencapai batas pemakaian promo ini (${promotion.perCustomerLimit}x)`,
          discountAmount: 0,
        };
      }
    }

    // Calculate discount amount
    let discountAmount = 0;
    const discountVal = Number(promotion.discountValue);

    if (promotion.discountType === DiscountType.PERCENTAGE) {
      discountAmount = Math.floor((subtotal * discountVal) / 100);
      if (promotion.maxDiscountAmount !== null && promotion.maxDiscountAmount !== undefined) {
        const maxDisc = Number(promotion.maxDiscountAmount);
        discountAmount = Math.min(discountAmount, maxDisc);
      }
    } else if (promotion.discountType === DiscountType.FIXED_AMOUNT) {
      discountAmount = Math.min(subtotal, discountVal);
    }

    return {
      valid: true,
      promotion,
      discountAmount,
    };
  }

  /**
   * Record promotion redemption during checkout
   */
  async recordUsage(
    tx: any,
    tenantId: string,
    promotionId: string,
    orderId: string,
    discountApplied: number,
    customerId?: string | null
  ) {
    // Increment usage count
    await tx.promotion.update({
      where: { id: promotionId },
      data: {
        usageCount: { increment: 1 },
      },
    });

    // Insert promotion usage audit row
    const usage = await tx.promotionUsage.create({
      data: {
        tenantId,
        promotionId,
        orderId,
        customerId: customerId || null,
        discountApplied,
      },
    });

    return usage;
  }
}

export const promotionService = new PromotionService();
