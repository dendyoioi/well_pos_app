import { prisma } from '../config/prisma';

export type GlobalAuditModule =
  | 'PROCUREMENT'
  | 'HR_PAYROLL'
  | 'ORDER'
  | 'PRICING'
  | 'FINANCE'
  | 'SECURITY'
  | 'SYSTEM';

export interface RecordGlobalAuditInput {
  tenantId: string;
  outletId?: string | null;
  actorUserId?: string | null;
  actorName?: string | null;
  actorRole?: string | null;
  module: GlobalAuditModule | string;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  beforeData?: any;
  afterData?: any;
  ipAddress?: string | null;
}

/**
 * Helper non-blocking untuk mencatat aktivitas penting ke Global Audit Trail.
 * Error di-catch dan dicatat via console.warn agar kegagalan audit logging
 * tidak membatalkan atau mengganggu transaksi bisnis utama.
 */
export async function recordGlobalAuditLog(input: RecordGlobalAuditInput): Promise<void> {
  try {
    await prisma.globalAuditLog.create({
      data: {
        tenantId: input.tenantId,
        outletId: input.outletId || null,
        actorUserId: input.actorUserId || null,
        actorName: input.actorName || null,
        actorRole: input.actorRole || null,
        module: input.module,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId || null,
        summary: input.summary,
        beforeData: input.beforeData !== undefined ? input.beforeData : undefined,
        afterData: input.afterData !== undefined ? input.afterData : undefined,
        ipAddress: input.ipAddress || null,
      },
    });
  } catch (err: any) {
    console.warn('[GlobalAuditTrail] ⚠️ Gagal mencatat audit log non-blocking:', err?.message || err);
  }
}
