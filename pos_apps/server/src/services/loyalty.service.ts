import { PrismaClient, CustomerTier, PointTxType } from '@prisma/client';
import { prisma } from '../config/prisma';

export interface AwardPointsInput {
  tenantId: string;
  customerId: string;
  orderId?: string;
  spendAmount: number;
  notes?: string;
}

export interface RedeemPointsInput {
  tenantId: string;
  customerId: string;
  orderId?: string;
  pointsToRedeem: number;
  subtotal: number;
}

export class LoyaltyService {
  // 1 Point = Rp 100
  static readonly POINT_VALUE_IDR = 100;
  // Spend Rp 10.000 = 1 base point
  static readonly SPEND_PER_POINT = 10000;

  // Tier spend thresholds (Lifetime totalSpent)
  static readonly TIER_THRESHOLDS = {
    PLATINUM: 15000000, // Rp 15 Juta
    GOLD: 5000000,      // Rp 5 Juta
    SILVER: 1000000,    // Rp 1 Juta
  };

  // Tier point multipliers
  static readonly TIER_MULTIPLIERS: Record<CustomerTier, number> = {
    BRONZE: 1.0,
    SILVER: 1.25,
    GOLD: 1.5,
    PLATINUM: 2.0,
  };

  /**
   * Determine tier based on total spent
   */
  resolveTier(totalSpent: number): CustomerTier {
    if (totalSpent >= LoyaltyService.TIER_THRESHOLDS.PLATINUM) {
      return CustomerTier.PLATINUM;
    }
    if (totalSpent >= LoyaltyService.TIER_THRESHOLDS.GOLD) {
      return CustomerTier.GOLD;
    }
    if (totalSpent >= LoyaltyService.TIER_THRESHOLDS.SILVER) {
      return CustomerTier.SILVER;
    }
    return CustomerTier.BRONZE;
  }

  /**
   * Calculate points earned from spend amount and tier
   */
  calculatePointsEarned(spendAmount: number, tier: CustomerTier = CustomerTier.BRONZE): number {
    if (spendAmount <= 0) return 0;
    const basePoints = Math.floor(spendAmount / LoyaltyService.SPEND_PER_POINT);
    const multiplier = LoyaltyService.TIER_MULTIPLIERS[tier] || 1.0;
    return Math.floor(basePoints * multiplier);
  }

  /**
   * Calculate maximum redeemable points given an order subtotal
   */
  calculateMaxRedeemable(subtotal: number, availablePoints: number): { maxPoints: number; maxDiscount: number } {
    // Max discount is 50% of subtotal
    const maxDiscountAllowed = Math.floor(subtotal * 0.5);
    const maxPointsAllowed = Math.floor(maxDiscountAllowed / LoyaltyService.POINT_VALUE_IDR);
    const maxPoints = Math.min(availablePoints, maxPointsAllowed);
    const maxDiscount = maxPoints * LoyaltyService.POINT_VALUE_IDR;
    return { maxPoints, maxDiscount };
  }

  /**
   * Award points on completed order (inside existing transaction or standalone)
   */
  async awardPoints(input: AwardPointsInput, txClient?: any) {
    const db = txClient || prisma;

    const customer = await db.customer.findFirst({
      where: { id: input.customerId, tenantId: input.tenantId },
    });

    if (!customer) {
      throw new Error('Customer tidak ditemukan');
    }

    const currentSpent = Number(customer.totalSpent || 0) + input.spendAmount;
    const currentVisits = Number(customer.visitCount || 0) + 1;
    const newTier = this.resolveTier(currentSpent);
    const pointsEarned = this.calculatePointsEarned(input.spendAmount, customer.tier);

    if (pointsEarned <= 0) {
      // Just update spend and visits if spend is below 10.000
      const updated = await db.customer.update({
        where: { id: customer.id },
        data: {
          totalSpent: currentSpent,
          visitCount: currentVisits,
          tier: newTier,
          updatedAt: new Date(),
        },
      });
      return { customer: updated, pointsEarned: 0 };
    }

    const balanceBefore = Number(customer.loyaltyPoints || 0);
    const balanceAfter = balanceBefore + pointsEarned;

    // Update customer record
    const updatedCustomer = await db.customer.update({
      where: { id: customer.id },
      data: {
        loyaltyPoints: balanceAfter,
        totalSpent: currentSpent,
        visitCount: currentVisits,
        tier: newTier,
        updatedAt: new Date(),
      },
    });

    // Record point ledger entry
    await db.customerPointLedger.create({
      data: {
        tenantId: input.tenantId,
        customerId: customer.id,
        orderId: input.orderId || null,
        deltaPoints: pointsEarned,
        balanceBefore,
        balanceAfter,
        type: PointTxType.EARNED_PURCHASE,
        notes: input.notes || `Poin transaksi belanja Rp ${input.spendAmount.toLocaleString('id-ID')} (${customer.tier} Tier)`,
      },
    });

    return { customer: updatedCustomer, pointsEarned };
  }

  /**
   * Redeem customer points for cash discount
   */
  async redeemPoints(input: RedeemPointsInput, txClient?: any) {
    const db = txClient || prisma;

    if (input.pointsToRedeem <= 0) {
      return { discountAmount: 0, pointsDeducted: 0 };
    }

    const customer = await db.customer.findFirst({
      where: { id: input.customerId, tenantId: input.tenantId },
    });

    if (!customer) {
      throw new Error('Customer tidak ditemukan');
    }

    const availablePoints = Number(customer.loyaltyPoints || 0);
    if (availablePoints < input.pointsToRedeem) {
      throw new Error(`Poin loyalitas tidak mencukupi. Tersedia: ${availablePoints}, diminta: ${input.pointsToRedeem}`);
    }

    const { maxPoints } = this.calculateMaxRedeemable(input.subtotal, availablePoints);
    if (input.pointsToRedeem > maxPoints) {
      throw new Error(`Maksimal penukaran poin untuk transaksi ini adalah ${maxPoints} poin (50% dari subtotal)`);
    }

    const discountAmount = input.pointsToRedeem * LoyaltyService.POINT_VALUE_IDR;
    const balanceBefore = availablePoints;
    const balanceAfter = balanceBefore - input.pointsToRedeem;

    // Deduct points
    await db.customer.update({
      where: { id: customer.id },
      data: {
        loyaltyPoints: balanceAfter,
        updatedAt: new Date(),
      },
    });

    // Record point ledger entry
    await db.customerPointLedger.create({
      data: {
        tenantId: input.tenantId,
        customerId: customer.id,
        orderId: input.orderId || null,
        deltaPoints: -input.pointsToRedeem,
        balanceBefore,
        balanceAfter,
        type: PointTxType.REDEEMED_DISCOUNT,
        notes: `Penukaran ${input.pointsToRedeem} poin untuk potongan belanja Rp ${discountAmount.toLocaleString('id-ID')}`,
      },
    });

    return { discountAmount, pointsDeducted: input.pointsToRedeem };
  }

  /**
   * Manual points adjustment by manager/superadmin
   */
  async adjustPoints(
    tenantId: string,
    customerId: string,
    deltaPoints: number,
    notes: string,
    type: PointTxType = PointTxType.MANUAL_ADJUSTMENT
  ) {
    return await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findFirst({
        where: { id: customerId, tenantId },
      });

      if (!customer) {
        throw new Error('Customer tidak ditemukan');
      }

      const balanceBefore = Number(customer.loyaltyPoints || 0);
      const balanceAfter = Math.max(0, balanceBefore + deltaPoints);
      const actualDelta = balanceAfter - balanceBefore;

      const updated = await tx.customer.update({
        where: { id: customer.id },
        data: {
          loyaltyPoints: balanceAfter,
          updatedAt: new Date(),
        },
      });

      await tx.customerPointLedger.create({
        data: {
          tenantId,
          customerId: customer.id,
          deltaPoints: actualDelta,
          balanceBefore,
          balanceAfter,
          type,
          notes,
        },
      });

      return { customer: updated, actualDelta, balanceAfter };
    });
  }
}

export const loyaltyService = new LoyaltyService();
