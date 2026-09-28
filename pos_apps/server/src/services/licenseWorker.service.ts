import { prisma } from '../config/prisma';
import { TenantStatus } from '@prisma/client';

export interface LicenseEvaluationResult {
  evaluatedCount: number;
  activeCount: number;
  dueNoticeCount: number;
  gracePeriodCount: number;
  suspendedCount: number;
  details: Array<{
    tenantId: string;
    businessName: string;
    previousStatus: TenantStatus;
    newStatus: TenantStatus;
    reason: string;
    expiresAt?: Date | null;
  }>;
}

export class LicenseWorkerService {
  /**
   * Evaluasi siklus hidup langganan seluruh tenant toko
   * Mendukung parameter simulatedDate untuk pengujian skenario waktu maju
   */
  async evaluateSubscriptionLifecycles(options?: { simulatedDate?: Date }): Promise<LicenseEvaluationResult> {
    const evalDate = options?.simulatedDate || new Date();

    const tenants = await prisma.tenant.findMany({
      where: {
        status: {
          in: [TenantStatus.TRIAL, TenantStatus.ACTIVE],
        },
      },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
      },
    });

    const result: LicenseEvaluationResult = {
      evaluatedCount: tenants.length,
      activeCount: 0,
      dueNoticeCount: 0,
      gracePeriodCount: 0,
      suspendedCount: 0,
      details: [],
    };

    for (const tenant of tenants) {
      const activeSub = tenant.subscriptions[0] || null;
      let targetExpiration: Date | null = null;

      if (activeSub && activeSub.expiresAt) {
        targetExpiration = activeSub.expiresAt;
      } else if (tenant.trialEndsAt) {
        targetExpiration = tenant.trialEndsAt;
      }

      // Jika tidak ada batasan waktu (misal plan khusus), tetap aktif
      if (!targetExpiration) {
        result.activeCount++;
        continue;
      }

      const diffMs = evalDate.getTime() - targetExpiration.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      if (diffDays > 3) {
        // Jatuh tempo lebih dari 3 hari (Masa tenggang terlewati) -> SUSPENDED
        await prisma.$transaction(async (tx) => {
          await tx.tenant.update({
            where: { id: tenant.id },
            data: { status: TenantStatus.SUSPENDED },
          });

          if (activeSub) {
            await tx.tenantSubscription.update({
              where: { id: activeSub.id },
              data: { isActive: false },
            });
          }
        });

        result.suspendedCount++;
        result.details.push({
          tenantId: tenant.id,
          businessName: tenant.name,
          previousStatus: tenant.status,
          newStatus: TenantStatus.SUSPENDED,
          reason: `Jatuh tempo terlewati ${Math.floor(diffDays)} hari (Grace period 3 hari habis)`,
          expiresAt: targetExpiration,
        });
      } else if (diffDays > 0 && diffDays <= 3) {
        // Jatuh tempo 1 - 3 hari yang lalu -> GRACE_PERIOD
        result.gracePeriodCount++;
        result.details.push({
          tenantId: tenant.id,
          businessName: tenant.name,
          previousStatus: tenant.status,
          newStatus: tenant.status,
          reason: `Dalam masa tenggang (Grace period hari ke-${Math.ceil(diffDays)})`,
          expiresAt: targetExpiration,
        });
      } else {
        // Belum jatuh tempo
        const daysRemaining = Math.abs(diffDays);
        if (daysRemaining <= 3) {
          // H-3 Menjelang jatuh tempo -> DUE_NOTICE
          result.dueNoticeCount++;
          result.details.push({
            tenantId: tenant.id,
            businessName: tenant.name,
            previousStatus: tenant.status,
            newStatus: tenant.status,
            reason: `Peringatan tagihan perpanjangan (H-${Math.ceil(daysRemaining)})`,
            expiresAt: targetExpiration,
          });
        } else {
          result.activeCount++;
        }
      }
    }

    return result;
  }
}

export const licenseWorkerService = new LicenseWorkerService();
